declare module 'ipfs-only-hash' {
  export interface IpfsOnlyHashOptions {
    cidVersion?: 0 | 1
    rawLeaves?: boolean
  }

  export function of(
    input:
      | string
      | ArrayBuffer
      | ArrayLike<number>
      | Iterable<number>
      | AsyncIterable<Uint8Array>,
    options?: IpfsOnlyHashOptions,
  ): Promise<string>
}
