// Every failed API call throws this. status is the HTTP status (0 = could not reach the server).
export class ApiError extends Error {
  constructor(status, message) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}
