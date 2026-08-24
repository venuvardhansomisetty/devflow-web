/**
 * Centralised error handling. Distinguishes "the database is unreachable"
 * from "something in our own code broke" so the frontend can show the
 * right empty/error state instead of a generic crash message.
 */
function errorHandler(err, req, res, next) { // eslint-disable-line no-unused-vars
  console.error(err);

  const message = err.message || 'Unexpected server error.';
  const isConnectionError =
    /ServiceUnavailable|Could not perform|ECONNREFUSED|connect|timeout|Missing CognoDB/i.test(message);

  if (isConnectionError) {
    return res.status(503).json({
      error: 'DATABASE_UNAVAILABLE',
      message: 'Could not reach the CognoDB instance. Check that it is running and that your connection details are correct.',
    });
  }

  return res.status(500).json({
    error: 'INTERNAL_ERROR',
    message,
  });
}

module.exports = errorHandler;
