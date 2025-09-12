import { apiPut } from '../api.js';

export async function updateAvatar(selectedId) {
    return await apiPut('profile/avatar', { avatar_id: selectedId });
}