const ignore = (): void => {}

export const callSafely = (call: () => unknown): void => {
  try {
    const result = call()
    if (typeof (result as PromiseLike<unknown> | null)?.then === 'function') {
      Promise.resolve(result).catch(ignore)
    }
  } catch {
    return
  }
}
