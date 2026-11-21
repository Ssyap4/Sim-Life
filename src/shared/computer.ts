/** The interface belongs to the logged-in resident, never to a physical machine. */
export type ComputerDevice = 'laptop' | 'desktop';
export const computerDevice = (value: unknown): value is ComputerDevice =>
  value === 'laptop' || value === 'desktop';
export const computerResource = (device: ComputerDevice) => device === 'laptop' ? 'career-laptop' : 'desk';
