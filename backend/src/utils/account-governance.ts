import { Role } from "@prisma/client";

export function canDeactivateUser(actorId: string, targetId: string, nextActive: boolean): boolean {
  return nextActive || actorId !== targetId;
}

export function canDeactivateLastActiveAdmin(
  role: Role,
  targetIsActive: boolean,
  nextActive: boolean,
  activeAdminCount: number,
): boolean {
  return nextActive || !targetIsActive || role !== Role.ADMIN || activeAdminCount > 1;
}
