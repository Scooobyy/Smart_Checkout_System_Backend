const debugRoutes = (req, res, next) => {
  console.log('🔍 DEBUG Route Hit:', {
    method: req.method,
    url: req.originalUrl,
    baseUrl: req.baseUrl,
    path: req.path,
    params: req.params,
    query: req.query
  });
  next();
};

module.exports = { debugRoutes };