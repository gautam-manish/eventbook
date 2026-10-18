export function validationError(res, issue) {
  return res
    .status(400)
    .json({ error: { message: `${issue.path[0]}: ${issue.message}` } });
}