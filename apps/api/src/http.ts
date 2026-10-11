/** A failure the player is told about. `status` is the HTTP status, `message` goes to the page as it is. */
export class HttpError extends Error {
  public readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = 'HttpError';
    this.status = status;
  }
}
