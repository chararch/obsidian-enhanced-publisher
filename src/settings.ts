import { App, Notice, Plugin, PluginSettingTab, Setting } from 'obsidian';

// 定义插件设置接口
export interface EnhancedPublisherSettings {
	wechatAppId: string;
	wechatAppSecret: string;
	autoSaveImages: boolean;
	hideImageFolders: boolean;
}

// 定义插件接口以避免循环导入
interface EnhancedPublisherPluginInterface extends Plugin {
	settings: EnhancedPublisherSettings;
	saveSettings(): Promise<void>;
}

// 默认设置
export const DEFAULT_SETTINGS: EnhancedPublisherSettings = {
	wechatAppId: '',
	wechatAppSecret: '',
	autoSaveImages: true,
	hideImageFolders: true
}

// 设置选项卡
export class EnhancedPublisherSettingTab extends PluginSettingTab {
	plugin: EnhancedPublisherPluginInterface;

	constructor(app: App, plugin: EnhancedPublisherPluginInterface) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const {containerEl} = this;
		containerEl.empty();

		// 使用设置项作为主标题
		new Setting(containerEl)
			.setName('增强发布插件设置')
			.setHeading();

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
		
		// 隐藏图片文件夹设置
		new Setting(containerEl)
			.setName('隐藏图片文件夹')
			.setDesc('在文件浏览器中隐藏图片文件夹(__assets)并将图片集成到文档中。启用后可以点击文档名展开/折叠查看图片。')
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.hideImageFolders)
				.onChange(async (value) => {
					this.plugin.settings.hideImageFolders = value;
					await this.plugin.saveSettings();
					// 立即更新可见性
					new Notice(`图片文件夹已${value ? '隐藏，可点击文档查看图片' : '显示'}`);
				}));

		// 添加微信公众号分组标题
		new Setting(containerEl)
			.setName('微信公众号设置')
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