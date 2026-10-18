import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import { supabase } from '../db.js';
import { validationError } from '../utils.js';

const router = Router();

const registerSchema = z.object({
    name: z.string().trim().min(2).max(100),
    email: z.string().trim().toLowerCase().email(),
    password: z.string().min(8).max(100),
});

const loginSchema = z.object({
    email: z.string().trim().toLowerCase().email(),
    password: z.string().min(1),
});

function signToken(user) {
    return jwt.sign({ sub: user.id, role: user.role }, process.env.JWT_SECRET, {
        expiresIn: '7d',
    });
}



router.post('/register', async (req, res, next) => {
    try {
        const parsed = registerSchema.safeParse(req.body);
        if (!parsed.success) return validationError(res, parsed.error.issues[0]);

        const { name, email, password } = parsed.data;
        const password_hash = await bcrypt.hash(password, 10);

        // role is never read from the request, so nobody can register as admin
        const { data, error } = await supabase
            .from('users')
            .insert({ name, email, password_hash })
            .select('id, name, email, role')
            .single();

        if (error) {
            if (error.code === '23505') {
                return res.status(409).json({ error: { message: 'Email already registered' } });
            }
            throw error;
        }

        res.status(201).json({ user: data, token: signToken(data) });
    } catch (err) {
        next(err);
    }
});

router.post('/login', async (req, res, next) => {
    try {
        const parsed = loginSchema.safeParse(req.body);
        if (!parsed.success) return validationError(res, parsed.error.issues[0]);

        const { email, password } = parsed.data;
        const { data: user, error } = await supabase
            .from('users')
            .select('id, name, email, role, password_hash')
            .eq('email', email)
            .maybeSingle();
        if (error) throw error;

        const ok = user && (await bcrypt.compare(password, user.password_hash));
        if (!ok) {
            return res.status(401).json({ error: { message: 'Invalid email or password' } });
        }

        const { password_hash, ...safeUser } = user;
        res.json({ user: safeUser, token: signToken(safeUser) });
    } catch (err) {
        next(err);
    }
});

export default router;