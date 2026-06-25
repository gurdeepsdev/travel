export const successResponse = (data = {}, meta = {}) => ({
    success: true,
    data,
    meta
  });
  
  export const errorResponse = (
    code,
    message,
    errors = []
  ) => ({
    success: false,
    code,
    message,
    errors
  });