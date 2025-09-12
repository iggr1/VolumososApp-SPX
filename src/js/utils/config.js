import { apiGet } from "../api.js";

export async function fetchConfig() {
    return await apiGet('config');
}