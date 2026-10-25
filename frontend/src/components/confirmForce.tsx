import type { ReactNode } from 'react';
import { Modal, message } from 'antd';
import type { ErrorCode } from '@contracts/enums';
import { ApiError, errorText, type RpcOptions } from '@/services/api';

/**
 * Delete flow for resources with a `force` flag: try without force; when the server answers with
 * `code` (NOT_EMPTY, PORT_HAS_DEPENDENTS), show why and ask before retrying with force.
 * Resolves true when the delete went through.
 */
export async function deleteWithForce(
  run: (force: boolean, opts: RpcOptions) => Promise<unknown>,
  ask: { code: ErrorCode; title: string; content: ReactNode; okText?: string; cancelText?: string },
): Promise<boolean> {
  try {
    await run(false, { silent: true });
    return true;
  } catch (e) {
    if (!(e instanceof ApiError) || e.code !== ask.code) {
      message.error(errorText(e));
      return false;
    }
    return new Promise<boolean>((resolve) => {
      Modal.confirm({
        title: ask.title,
        content: (
          <div>
            <p>{ask.content}</p>
            <p style={{ color: '#8c8c8c' }}>{errorText(e)}</p>
          </div>
        ),
        okText: ask.okText,
        cancelText: ask.cancelText,
        okButtonProps: { danger: true },
        onOk: async () => {
          try {
            await run(true, {});
            resolve(true);
          } catch {
            resolve(false);
          }
        },
        onCancel: () => resolve(false),
      });
    });
  }
}
