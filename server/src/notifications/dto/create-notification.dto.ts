export class CreateNotificationDto {
  title: string;
  content: string;
  /**
   * 通知类型：all(全园) / course(课程) / class(班级) / personal(个人) / teacher(教师)
   */
  type: string;
  /**
   * 选中对象的 id 数组：
   * - course: 课程 id 数组
   * - class: 班级 id 数组
   * - personal: 幼儿 id 数组
   * - teacher: 教师 id 数组
   * - all: 忽略
   */
  target_ids?: string[];
  /**
   * 状态：draft(草稿) / published(已发布)，默认 draft
   */
  status?: string;
  /**
   * 图片附件占位（url 数组）
   */
  images?: string[];
}