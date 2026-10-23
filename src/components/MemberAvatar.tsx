import type { RoomMember } from "@/types";

export default function MemberAvatar({ member, size = 26 }: { member: Pick<RoomMember, "name" | "avatar">; size?: number }) {
  return member.avatar ? (
    <img src={member.avatar} alt={member.name} width={size} height={size} className="block shrink-0 rounded-full border-2 border-secondary" />
  ) : (
    <div
      className="flex shrink-0 items-center justify-center rounded-full border-2 border-secondary bg-primary font-bold text-primary-foreground"
      style={{ width: size, height: size, fontSize: size * 0.4 }}
    >
      {member.name[0].toUpperCase()}
    </div>
  );
}
