// cat > src/modules/users/services/profile.service.js <<'EOF'
import UserNotFoundError from "../../../core/errors/users/user-not-found.error.js";

import profileMapper from "../mappers/profile.mapper.js";
import { profilesRepository } from "../repositories/index.js";


class ProfileService {
  async getMyProfile(userId) {
    const profile = await profilesRepository.findByUserId(userId);

    if (!profile) {
      throw new UserNotFoundError({
        details: {
          userId,
        },
      });
    }

    return profileMapper.toResponse(profile);
  }



}

export default new ProfileService();
