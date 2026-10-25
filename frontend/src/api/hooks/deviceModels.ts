import { useQuery } from '@tanstack/react-query';
import type { In } from '@/services/api';
import type { deviceModelListSchema } from '@contracts/devices';
import { deviceModelService } from '@/services/deviceService';

export function useDeviceModels(body: In<typeof deviceModelListSchema> = {}) {
  return useQuery({
    queryKey: ['device-models', 'list', body],
    queryFn: () => deviceModelService.list(body),
  });
}
