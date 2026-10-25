import { useQuery } from '@tanstack/react-query';
import { roomService } from '@/services/hierarchyService';

/** rooms/list, optionally limited to one data center. */
export function useRoomList(dataCenterId?: string) {
  const body = { dataCenterId };
  return useQuery({
    queryKey: ['rooms', 'list', body],
    queryFn: () => roomService.list(body),
  });
}

/** rooms/scene: everything the 3D view draws; disabled until a room is chosen. */
export function useRoomScene(roomId: string | null) {
  const body = { roomId: roomId ?? '' };
  return useQuery({
    queryKey: ['rooms', 'scene', body],
    queryFn: () => roomService.scene(body),
    enabled: roomId !== null,
  });
}
