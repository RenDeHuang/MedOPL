export class RealTkeLifecycleFailure extends Error {
  constructor(blocker, details = {}, status = 1) {
    super(blocker);
    this.blocker = blocker;
    this.details = details;
    this.status = status;
  }
}

export function failClosed(blocker, details = {}, status = 1) {
  throw new RealTkeLifecycleFailure(blocker, details, status);
}
