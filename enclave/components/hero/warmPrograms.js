// yields to the event loop without setTimeout's 4 ms clamping
const nextTask = () =>
  new Promise((resolve) => {
    const channel = new MessageChannel();
    channel.port1.onmessage = () => resolve();
    channel.port2.postMessage(0);
  });

/**
 * Fetches each linked shader program's uniform and attribute tables, one program per task. three
 * does this on a program's first draw, and every program costs a synchronous round trip to the
 * GPU process: for a freshly compiled scene they all land in its first frame, one long task.
 * Only programs whose parallel compile has finished are touched (asking a program that is still
 * compiling would block until it links); the data is the same either way, it is just fetched early.
 */
export async function warmProgramInfo(gl) {
  for (const program of [...(gl.info.programs || [])]) {
    await nextTask();
    if (program.isReady()) program.getUniforms();
  }
}
