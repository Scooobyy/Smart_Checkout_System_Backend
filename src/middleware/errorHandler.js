const errorHandler = (err, req, res, next) => {
  console.error('Error:', err.message);
  
  // Default error
  let error = { ...err };
  error.message = err.message;

  // PostgreSQL duplicate key error
  if (err.code === '23505') {
    const message = 'Resource already exists with this data';
    return res.status(409).json({
      status: 'error',
      message
    });
  }

  // PostgreSQL foreign key violation
  if (err.code === '23503') {
    const message = 'Referenced resource not found';
    return res.status(400).json({
      status: 'error',
      message
    });
  }

  res.status(err.statusCode || 500).json({
    status: 'error',
    message: error.message || 'Server Error'
  });
};

module.exports = errorHandler;