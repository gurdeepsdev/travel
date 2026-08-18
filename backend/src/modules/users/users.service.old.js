import profileService from "./services/profile.service.js";

class UsersService {

    async getMyProfile(userId) {

        return profileService.getMyProfile(userId);

    }

}

export default new UsersService();
