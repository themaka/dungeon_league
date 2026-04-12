const DEV_USER_ID = "dev-user-1";
const DEV_USER_NAME = "Player One";

export function getCurrentUser() {
  return {
    id: DEV_USER_ID,
    name: DEV_USER_NAME,
  };
}
