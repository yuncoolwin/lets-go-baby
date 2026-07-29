export class CreateNotificationDto {
  title: string;
  content: string;
  type: string;
  scope?: string;
  target_ids?: string;
  is_pinned?: boolean;
}
