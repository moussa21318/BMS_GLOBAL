export function hash(pw: string): string {
  let h = 0
  for (let i = 0; i < pw.length; i++) h = ((h << 5) - h) + pw.charCodeAt(i)
  return 'h_' + Math.abs(h).toString(36)
}
