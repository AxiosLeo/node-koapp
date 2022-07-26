interface ControllerInterface {
  response(data: unknown, code?: StatusCode, status?: number, headers?: Record<string, string>): void;
  result(data: unknown, status?: number, headers?: Record<string, string>): void;
  success(data?: unknown, headers?: Record<string, string>): void;
  failed(data?: unknown, code?: StatusCode, status?: number, headers?: Record<string, string>): void;
  error(status: number, msg: string, headers?: Record<string, string>): void;
  log(...data: any): void;
}


export declare class Controller implements ControllerInterface {
  response(data: unknown, code?: StatusCode, status?: number, headers?: Record<string, string>): void;
  result(data: unknown, status?: number, headers?: Record<string, string>): void;
  success(data?: unknown, headers?: Record<string, string>): void;
  failed(data?: unknown, code?: StatusCode, status?: number, headers?: Record<string, string>): void;
  error(status: number, msg: string, headers?: Record<string, string>): void;
  log(...data: any): void;
}