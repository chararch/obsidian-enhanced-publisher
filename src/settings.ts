import { App, Notice, Plugin, PluginSettingTab, Setting } from 'obsidian';

// 定义插件设置接口
export interface EnhancedPublisherSettings {
	wechatAppId: string;
	wechatAppSecret: string;
	autoSaveImages: boolean;
	hideImageFolders: boolean;
	imageAttachmentLocation: string;
	debugMode: boolean;
}

// 定义插件接口以避免循环导入
interface EnhancedPublisherPluginInterface extends Plugin {
	settings: EnhancedPublisherSettings;
	saveSettings(): Promise<void>;
	fileExplorerEnhancer: any;
}

// 默认设置
export const DEFAULT_SETTINGS: EnhancedPublisherSettings = {
	wechatAppId: '',
	wechatAppSecret: '',
	autoSaveImages: true,
	hideImageFolders: true,
	imageAttachmentLocation: '${filename}__assets',
	debugMode: false
}

// 设置选项卡
export class EnhancedPublisherSettingTab extends PluginSettingTab {
	plugin: EnhancedPublisherPluginInterface;

	constructor(app: App, plugin: EnhancedPublisherPluginInterface) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;
		containerEl.empty();

		// 图片自动保存设置
		new Setting(containerEl)
			.setName('自动保存图片')
			.setDesc('粘贴图片时自动保存到文档同名文件夹')
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.autoSaveImages)
				.onChange(async (value) => {
					this.plugin.settings.autoSaveImages = value;
					await this.plugin.saveSettings();
				}));

		// 图片存储位置设置
		new Setting(containerEl)
			.setName('图片存储位置')
			.setDesc('设置图片保存的文件夹路径。支持使用 ${filename} 代表当前文档的文件名。例如：${filename}__assets (默认) 或 attachments/${filename}')
			.addText(text => text
				.setPlaceholder('${filename}__assets')
				.setValue(this.plugin.settings.imageAttachmentLocation)
				.onChange(async (value) => {
					this.plugin.settings.imageAttachmentLocation = value;
					await this.plugin.saveSettings();

					// 提示用户需要重启文件浏览器增强
					if (this.plugin.settings.hideImageFolders) {
						new Notice('设置已保存。为确保"隐藏图片文件夹"功能正常工作，建议重启插件或重新加载Obisidian。', 5000);
					}
				}));

		// 隐藏图片文件夹设置
		new Setting(containerEl)
			.setName('隐藏图片文件夹')
			.setDesc('在文件浏览器中隐藏图片文件夹(__assets)并将图片集成到文档中。启用后可以点击文档名展开/折叠查看图片。')
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.hideImageFolders)
				.onChange(async (value) => {
					this.plugin.settings.hideImageFolders = value;
					await this.plugin.saveSettings();
					// 更新文件浏览器增强器的隐藏状态
					this.plugin.fileExplorerEnhancer.setAssetFolderVisibility(value);
					// 立即更新可见性
					new Notice(`图片文件夹已${value ? '隐藏，可点击文档查看图片' : '显示'}`);
				}));

		// 调试模式设置
		new Setting(containerEl)
			.setName('调试模式')
			.setDesc('启用后将显示详细的调试日志信息')
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.debugMode)
				.onChange(async (value) => {
					this.plugin.settings.debugMode = value;
					await this.plugin.saveSettings();
				}));

		// 添加微信公众号分组标题
		new Setting(containerEl)
			.setName('微信公众号')
			.setHeading();

		new Setting(containerEl)
			.setName('AppID')
			.setDesc('微信公众号的AppID')
			.setClass('wechat-setting-appid')
			.addText(text => text
				.setPlaceholder('输入AppID')
				.setValue(this.plugin.settings.wechatAppId)
				.onChange(async (value) => {
					this.plugin.settings.wechatAppId = value;
					await this.plugin.saveSettings();
				}));


		new Setting(containerEl)
			.setName('AppSecret')
			.setDesc('微信公众号的AppSecret')
			.setClass('wechat-setting-appsecret')
			.addText(text => text
				.setPlaceholder('输入AppSecret')
				.setValue(this.plugin.settings.wechatAppSecret)
				.onChange(async (value) => {
					this.plugin.settings.wechatAppSecret = value;
					await this.plugin.saveSettings();
				}));
	}
} 