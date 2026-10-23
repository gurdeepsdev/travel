import Service from './community.service.js';
import Response from '../../core/response/index.js';

export const handle = (action, message = 'Community updated successfully.', created = false) => async (req, res, next) => {
  try {
    const result = await action(Service, req.user.id, req.validated);
    return created ? Response.created(res, result, message) : Response.success(res, result, message);
  } catch (error) { next(error); }
};
