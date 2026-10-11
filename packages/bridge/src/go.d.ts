declare class Go {
  importObject: WebAssembly.Imports;
  run(instance: WebAssembly.Instance): Promise<void>;
}

declare function suggestMove(positionJson: string, playouts: number): string;
