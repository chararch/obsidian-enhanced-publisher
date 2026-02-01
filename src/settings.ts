import { App, Notice, Plugin, PluginSettingTab, Setting } from 'obsidian';
import { WechatThemeStyle, WechatThemeColor, THEME_STYLE_NAMES, THEME_COLOR_NAMES } from './types/wechat-theme';

// 定义插件设置接口
export interface EnhancedPublisherSettings {
	wechatAppId: string;
	wechatAppSecret: string;
	autoSaveImages: boolean;
	hideImageFolders: boolean;
	imageAttachmentLocation: string;
	debugMode: boolean;
	enableWechatStyle: boolean; // 启用微信样式渲染
	wechatThemeStyle: WechatThemeStyle; // 微信主题样式
	wechatThemeColor: WechatThemeColor; // 微信主题颜色
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
	debugMode: false,
	enableWechatStyle: true, // 默认启用微信样式
	wechatThemeStyle: WechatThemeStyle.MODERN_MINIMAL, // 默认现代简约主题
	wechatThemeColor: WechatThemeColor.CLASSIC_BLUE // 默认经典蓝
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

		new Setting(containerEl)
			.setName('启用微信样式渲染')
			.setDesc('启用后将使用微信公众号优化的样式渲染，包括代码高亮、表格样式等')
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.enableWechatStyle)
				.onChange(async (value) => {
					this.plugin.settings.enableWechatStyle = value;
					await this.plugin.saveSettings();
					new Notice(`微信样式渲染已${value ? '启用' : '禁用'}`);
				}));

		new Setting(containerEl)
			.setName('主题样式')
			.setDesc('选择微信公众号文章的样式风格')
			.addDropdown(dropdown => dropdown
				.addOption(WechatThemeStyle.MODERN_MINIMAL, THEME_STYLE_NAMES[WechatThemeStyle.MODERN_MINIMAL])
				.addOption(WechatThemeStyle.TECH_FUTURE, THEME_STYLE_NAMES[WechatThemeStyle.TECH_FUTURE])
				.addOption(WechatThemeStyle.WARM_ORANGE, THEME_STYLE_NAMES[WechatThemeStyle.WARM_ORANGE])
				.addOption(WechatThemeStyle.FRESH_GREEN, THEME_STYLE_NAMES[WechatThemeStyle.FRESH_GREEN])
				.addOption(WechatThemeStyle.ELEGANT_VIOLET, THEME_STYLE_NAMES[WechatThemeStyle.ELEGANT_VIOLET])
				.addOption(WechatThemeStyle.CHINESE_STYLE, THEME_STYLE_NAMES[WechatThemeStyle.CHINESE_STYLE])
				.setValue(this.plugin.settings.wechatThemeStyle)
				.onChange(async (value) => {
					this.plugin.settings.wechatThemeStyle = value as WechatThemeStyle;
					await this.plugin.saveSettings();
					new Notice(`主题样式已切换为：${THEME_STYLE_NAMES[value as WechatThemeStyle]}`);
				}));

		new Setting(containerEl)
			.setName('主题颜色')
			.setDesc('选择微信公众号文章的主题色')
			.addDropdown(dropdown => {
				// 添加所有颜色选项
				Object.values(WechatThemeColor).forEach(color => {
					dropdown.addOption(color, THEME_COLOR_NAMES[color]);
				});
				return dropdown
					.setValue(this.plugin.settings.wechatThemeColor)
					.onChange(async (value) => {
						this.plugin.settings.wechatThemeColor = value as WechatThemeColor;
						await this.plugin.saveSettings();
						new Notice(`主题颜色已切换为：${THEME_COLOR_NAMES[value as WechatThemeColor]}`);
					});
			});
	}
} 