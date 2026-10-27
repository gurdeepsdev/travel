import AppError from '../../core/errors/app-error.js';

export function validateMessageLimits(conversation, input) {
  const community = conversation.conversation_type === 'community';
  const limit = community ? 4096 : 512;
  const message = input.text?.length > limit ? `Message cannot exceed ${limit} characters.`
    : community && input.assetIds?.length > 5 ? 'Community messages cannot contain more than 5 attachments.' : null;
  if (message) throw new AppError({ code: 'COMMON.VALIDATION_FAILED', statusCode: 400, message,
    details: { formErrors: [], fieldErrors: { body: [message] } } });
}
