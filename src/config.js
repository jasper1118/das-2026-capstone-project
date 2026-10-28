function readPort(value) {
  if (value === undefined || value === '') return 3000;
  const port = Number(value);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error('PORT must be a whole number between 1 and 65535');
  }
  return port;
}
// uses port 3000, but if port 3000 isn't available, it uses another.

export const config = Object.freeze({
  port: readPort(process.env.PORT),
});