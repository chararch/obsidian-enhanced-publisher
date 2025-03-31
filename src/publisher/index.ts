import { MarkdownView } from 'obsidian';
import EnhancedPublisherPlugin from '../main';
import { PublishModal } from '../ui/modals';

// 平台发布接口
export interface PublishPlatform {
    name: string;
    publish(title: string, content: string): Promise<boolean>;
}

// 显示发布模态框
export function showPublishModal(this: EnhancedPublisherPlugin, markdownView: MarkdownView) {
    const modal = new PublishModal(this.app, this, markdownView);
    modal.open();
} 