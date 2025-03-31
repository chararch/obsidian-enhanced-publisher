import { App, MarkdownView, Modal, Notice, Setting, TFile } from 'obsidian';
import EnhancedPublisherPlugin from '../main';
import { markdownToHtml } from '../html-preview';
import { getWechatMaterials, uploadImageToWechat } from '../publisher/wechat';

// 封面图选择模态框
export class CoverImageModal extends Modal {
	plugin: EnhancedPublisherPlugin;
	selectedMediaId: string = '';
	onImageSelected: (mediaId: string) => void;
	
	constructor(app: App, plugin: EnhancedPublisherPlugin, onImageSelected: (mediaId: string) => void) {
		super(app);
		this.plugin = plugin;
		this.onImageSelected = onImageSelected;
	}
	
	async onOpen() {
		const {contentEl} = this;
		contentEl.empty();
		contentEl.addClass('wechat-cover-image-modal');
		
		const modalEl = (this.containerEl.querySelector('.modal') as HTMLElement);
		if (modalEl) {
			modalEl.classList.add('mod-wechat-cover');
		}
		
		contentEl.createEl('h2', {text: '选择封面图'});
		
		// 创建标签页切换
		const tabsContainer = contentEl.createDiv({cls: 'wechat-cover-tabs'});
		
		// 素材库标签
		const materialTab = tabsContainer.createDiv({cls: 'wechat-cover-tab'});
		materialTab.textContent = '素材库';
		materialTab.style.borderBottom = '2px solid var(--interactive-accent)';
		
		// 本地图片标签
		const localTab = tabsContainer.createDiv({cls: 'wechat-cover-tab'});
		localTab.textContent = '本地图片';
		
		// 内容容器
		const contentContainer = contentEl.createDiv({cls: 'wechat-cover-content'});
		
		// 素材库内容
		const materialContent = contentContainer.createDiv({cls: 'wechat-material-content'});
		
		// 加载中提示
		const loadingEl = materialContent.createEl('div', {text: '正在加载素材...'});
		loadingEl.style.textAlign = 'center';
		loadingEl.style.padding = '20px';
		
		// 创建素材网格容器
		const materialGrid = materialContent.createDiv({cls: 'material-grid'});
		
		// 创建分页控制器
		const paginationContainer = materialContent.createDiv({cls: 'pagination-container'});
		
		const prevButton = paginationContainer.createEl('button', {text: '上一页'});
		prevButton.disabled = true;
		
		const pageInfo = paginationContainer.createEl('span');
		pageInfo.textContent = '第1页';
		
		const nextButton = paginationContainer.createEl('button', {text: '下一页'});
		nextButton.disabled = true;
		
		// 本地上传内容
		const localContent = contentContainer.createDiv({cls: 'wechat-local-content'});
		localContent.style.display = 'none';
		
		// 创建文件选择按钮容器
		const fileInputContainer = localContent.createDiv({cls: 'file-input-container'});
		const fileInput = fileInputContainer.createEl('input');
		fileInput.type = 'file';
		fileInput.accept = 'image/*';
		
		// 创建预览区域容器
		const imagePreviewContainer = localContent.createDiv({cls: 'image-preview-container'});
		const imagePreview = imagePreviewContainer.createEl('div', {cls: 'image-preview'});
		imagePreview.textContent = '预览区域';
		
		// 底部按钮
		const buttonContainer = contentEl.createDiv({cls: 'wechat-cover-buttons'});
		buttonContainer.style.display = 'flex';
		buttonContainer.style.justifyContent = 'flex-end';
		buttonContainer.style.gap = '10px';
		buttonContainer.style.marginTop = '20px';
		
		const cancelButton = buttonContainer.createEl('button', {text: '取消'});
		const confirmButton = buttonContainer.createEl('button', {
			text: '确认',
			cls: 'wechat-confirm-button'
		});
		confirmButton.disabled = true;
		
		// 设置确认按钮样式
		confirmButton.style.backgroundColor = 'var(--interactive-accent)';
		confirmButton.style.color = 'var(--text-on-accent)';
		
		cancelButton.addEventListener('click', () => this.close());
		
		// 添加分页相关变量
		let currentPage = 0;
		const pageSize = 20;
		let totalCount = 0;
		
		// 加载素材库函数
		const loadMaterialsPage = async (page: number) => {
			try {
				materialGrid.empty();
				loadingEl.style.display = 'block';
				
				const materials = await getWechatMaterials.call(this.plugin, page, pageSize);
				
				if (materials.items.length === 0 && page === 0) {
					materialGrid.createEl('div', {text: '没有找到素材，请上传新图片'});
					return;
				}
				
				// 更新分页信息
				totalCount = materials.totalCount;
				currentPage = page;
				pageInfo.textContent = `第${page + 1}页 / 共${Math.ceil(totalCount / pageSize)}页`;
				
				// 更新分页按钮状态
				prevButton.disabled = page === 0;
				nextButton.disabled = (page + 1) * pageSize >= totalCount;
				
				// 加载素材项
				loadingEl.style.display = 'none';
				
				for (const material of materials.items) {
					const materialItem = materialGrid.createDiv({cls: 'material-item'});
					
					// 添加图片
					const img = materialItem.createEl('img');
					img.src = material.url;
					
					// 添加素材名称
					const nameEl = materialItem.createEl('div', {text: material.name || '未命名素材'});
					nameEl.style.fontSize = '12px';
					
					// 点击选择素材
					materialItem.addEventListener('click', () => {
						// 移除其他选中项的样式
						const items = materialGrid.querySelectorAll('.material-item');
						items.forEach((item: HTMLElement) => {
							item.style.border = '1px solid var(--background-modifier-border)';
						});
						
						// 设置当前选中项的样式
						materialItem.style.border = '2px solid var(--interactive-accent)';
						
						// 设置选中的media_id
						this.selectedMediaId = material.media_id;
						
						// 存储当前选中的素材信息
						sessionStorage.setItem('selected_material', JSON.stringify({
							media_id: material.media_id,
							url: material.url,
							name: material.name
						}));
						
						// 添加确认按钮
						if (!buttonContainer.querySelector('.confirm-button')) {
							const confirmButton = buttonContainer.createEl('button', {
								text: '确认选择',
								cls: 'confirm-button'
							});
							
							confirmButton.addEventListener('click', () => {
								this.onImageSelected(this.selectedMediaId);
								this.close();
							});
						}
					});
				}
			} catch (error) {
				console.error('加载素材库失败:', error);
				loadingEl.textContent = '加载素材库失败，请检查网络连接';
			}
		};
		
		// 标签切换事件
		materialTab.addEventListener('click', () => {
			materialTab.style.borderBottom = '2px solid var(--interactive-accent)';
			localTab.style.borderBottom = 'none';
			materialContent.style.display = 'flex';
			localContent.style.display = 'none';
		});
		
		localTab.addEventListener('click', () => {
			localTab.style.borderBottom = '2px solid var(--interactive-accent)';
			materialTab.style.borderBottom = 'none';
			materialContent.style.display = 'none';
			localContent.style.display = 'flex';
		});
		
		// 文件选择事件
		fileInput.addEventListener('change', (e) => {
			const target = e.target as HTMLInputElement;
			if (target.files && target.files.length > 0) {
				const selectedFile = target.files[0];
				
				// 显示预览
				const reader = new FileReader();
				reader.onload = (e) => {
					if (e.target && e.target.result) {
						imagePreview.empty();
						const img = imagePreview.createEl('img');
						img.src = e.target.result as string;
						img.style.maxWidth = '100%';
						img.style.maxHeight = '100%';
						
						// 保存预览图URL
						sessionStorage.setItem('preview_image_url', e.target.result as string);
					}
				};
				reader.readAsDataURL(selectedFile);
				
				confirmButton.disabled = false;
				
				// 保存选中的文件
				sessionStorage.setItem('selected_file', JSON.stringify({
					name: selectedFile.name,
					type: selectedFile.type,
					size: selectedFile.size
				}));
			} else {
				imagePreview.textContent = '预览区域';
				confirmButton.disabled = true;
				sessionStorage.removeItem('preview_image_url');
				sessionStorage.removeItem('selected_file');
			}
		});
		
		// 确认按钮事件
		confirmButton.addEventListener('click', () => {
			const selectedFileInfo = sessionStorage.getItem('selected_file');
			const previewImageUrl = sessionStorage.getItem('preview_image_url');
			
			if (!selectedFileInfo || !previewImageUrl) {
				new Notice('请先选择图片');
				return;
			}
			
			const fileInfo = JSON.parse(selectedFileInfo);
			
			// 存储当前选中的图片信息，标记为本地图片
			sessionStorage.setItem('selected_material', JSON.stringify({
				media_id: '',  // 此时还没有media_id
				url: previewImageUrl,
				name: fileInfo.name,
				isLocal: true,
				fileInfo: fileInfo  // 保存文件信息，供后续上传使用
			}));
			
			this.onImageSelected('');  // 传空字符串表示是本地图片
			this.close();
		});
		
		// 分页按钮事件
		prevButton.addEventListener('click', () => {
			if (currentPage > 0) {
				loadMaterialsPage(currentPage - 1);
			}
		});
		
		nextButton.addEventListener('click', () => {
			if ((currentPage + 1) * pageSize < totalCount) {
				loadMaterialsPage(currentPage + 1);
			}
		});
		
		// 初始化加载第一页
		await loadMaterialsPage(0);
	}
	
	onClose() {
		const {contentEl} = this;
		contentEl.empty();
	}
}

// 发布模态框
export class PublishModal extends Modal {
	plugin: EnhancedPublisherPlugin;
	markdownView: MarkdownView;
	titleInput: HTMLInputElement;
	platformSelect: HTMLSelectElement;
	coverImagePreview: HTMLElement;
	selectedCoverMediaId: string = '';

	constructor(app: App, plugin: EnhancedPublisherPlugin, markdownView: MarkdownView) {
		super(app);
		this.plugin = plugin;
		this.markdownView = markdownView;
	}

	onOpen() {
		const {contentEl} = this;
		contentEl.empty();
		
		// 添加相同的处理
		const modalEl = (this.containerEl.querySelector('.modal') as HTMLElement);
		if (modalEl) {
			modalEl.classList.add('mod-publish');
		}
		
		contentEl.createEl('h2', {text: '发布到内容平台'});
		
		// 标题输入
		const titleSetting = new Setting(contentEl)
			.setName('标题')
			.setDesc('文章标题');
		
		this.titleInput = document.createElement('input');
		this.titleInput.type = 'text';
		this.titleInput.value = this.markdownView.file?.basename || '';
		this.titleInput.style.width = '100%';
		
		titleSetting.controlEl.appendChild(this.titleInput);
		
		// 平台选择
		const platformSetting = new Setting(contentEl)
			.setName('平台')
			.setDesc('选择发布平台');
		
		this.platformSelect = document.createElement('select');
		this.platformSelect.className = 'enhanced-publisher-platform-selector';
		
		const wechatOption = document.createElement('option');
		wechatOption.value = 'wechat';
		wechatOption.text = '微信公众号';
		this.platformSelect.appendChild(wechatOption);
		
		// 未来可以添加更多平台选项
		
		platformSetting.controlEl.appendChild(this.platformSelect);
		
		// 添加草稿复选框
		const draftSetting = new Setting(contentEl)
			.setName('草稿')
			.setDesc('当前仅支持保存到草稿箱，后续将支持直接发布');
		
		const draftCheckbox = document.createElement('input');
		draftCheckbox.type = 'checkbox';
		draftCheckbox.checked = true;
		draftCheckbox.disabled = true;
		draftSetting.controlEl.appendChild(draftCheckbox);
		
		// 封面图选择（仅对微信公众号显示）
		const coverImageSetting = new Setting(contentEl)
			.setName('封面图')
			.setDesc('选择文章封面图');
			
		// 封面图预览区域
		this.coverImagePreview = document.createElement('div');
		this.coverImagePreview.className = 'enhanced-publisher-cover-preview';
		this.coverImagePreview.style.width = '120px';
		this.coverImagePreview.style.height = '80px';
		this.coverImagePreview.style.border = '1px dashed var(--background-modifier-border)';
		this.coverImagePreview.style.display = 'flex';
		this.coverImagePreview.style.alignItems = 'center';
		this.coverImagePreview.style.justifyContent = 'center';
		this.coverImagePreview.style.marginRight = '10px';
		this.coverImagePreview.textContent = '无封面图';
		
		// 选择按钮
		const selectCoverButton = document.createElement('button');
		selectCoverButton.textContent = '选择封面图';
		selectCoverButton.addEventListener('click', () => {
			// 打开封面图选择模态框
			const coverImageModal = new CoverImageModal(this.app, this.plugin, (mediaId) => {
				this.selectedCoverMediaId = mediaId;
				
				// 更新预览区域
				this.coverImagePreview.empty();
				const img = document.createElement('img') as HTMLImageElement;
				img.style.maxWidth = '100%';
				img.style.maxHeight = '100%';
				
				// 从sessionStorage获取选中的素材信息
				const selectedMaterial = sessionStorage.getItem('selected_material');
				if (selectedMaterial) {
					const material = JSON.parse(selectedMaterial);
					if (material.url) {
						img.src = material.url;
						this.coverImagePreview.appendChild(img);
					} else {
						this.coverImagePreview.textContent = '已选择封面图';
					}
				} else {
					this.coverImagePreview.textContent = '已选择封面图';
				}
			});
			coverImageModal.open();
		});
		
		// 创建封面图选择区域的容器
		const coverImageContainer = document.createElement('div');
		coverImageContainer.style.display = 'flex';
		coverImageContainer.style.alignItems = 'center';
		
		coverImageContainer.appendChild(this.coverImagePreview);
		coverImageContainer.appendChild(selectCoverButton);
		
		coverImageSetting.controlEl.appendChild(coverImageContainer);
		
		// 创建发布按钮容器并居中
		const publishButtonContainer = contentEl.createDiv();
		publishButtonContainer.style.textAlign = 'center';
		publishButtonContainer.style.marginTop = '30px'; // 增加上边距
		
		// 发布按钮
		const publishButton = publishButtonContainer.createEl('button', {
			text: '发布',
			cls: 'enhanced-publisher-publish-button'
		});
		
		publishButton.addEventListener('click', async () => {
			const title = this.titleInput.value;
			const platform = this.platformSelect.value;
			
			if (!title) {
				new Notice('请输入标题');
				return;
			}
			
			if (platform === 'wechat' && !this.coverImagePreview.querySelector('img')) {
				new Notice('请选择封面图');
				return;
			}
    
			if (!this.markdownView.file) {
				new Notice('无法获取当前文件');
				return;
			}
			
			// 获取内容并转换为HTML
			const content = this.markdownView.getViewData();
			const htmlContent = await markdownToHtml.call(this.plugin, content);
			
			if (platform === 'wechat') {
				if (!this.plugin.settings.wechatAppId || !this.plugin.settings.wechatAppSecret) {
					new Notice('请先在设置中配置微信公众号的AppID和AppSecret');
					return;
				}
				
				try {
					// 检查是否需要上传本地图片
					const selectedMaterial = sessionStorage.getItem('selected_material');
					if (selectedMaterial) {
						const material = JSON.parse(selectedMaterial);
						if (material.isLocal && !material.media_id) {
							publishButton.disabled = true;
							publishButton.textContent = '正在上传封面图...';
							
							try {
								// 获取文件内容
								const response = await fetch(material.url);
								const blob = await response.blob();
								const buffer = await blob.arrayBuffer();
								
								// 上传到微信
								const mediaId = await uploadImageToWechat.call(this.plugin, buffer, material.fileInfo.name);
								
								if (mediaId) {
									this.selectedCoverMediaId = mediaId;
									material.media_id = mediaId;
									sessionStorage.setItem('selected_material', JSON.stringify(material));
								} else {
									throw new Error('封面图上传失败');
								}
							} catch (error) {
								console.error('上传封面图失败:', error);
								new Notice('上传封面图失败');
								publishButton.disabled = false;
								publishButton.textContent = '发布';
								return;
							}
						} else {
							this.selectedCoverMediaId = material.media_id;
						}
					}
					
					publishButton.textContent = '正在发布...';
					const success = await this.plugin.publishToWechat(
						title,
						htmlContent,
						this.selectedCoverMediaId,
						this.markdownView.file
					);
					
					if (success) {
						this.close();
					}
				} catch (error) {
					console.error('发布失败:', error);
					new Notice('发布失败：' + (error.message || '未知错误'));
					publishButton.disabled = false;
					publishButton.textContent = '发布';
				}
			}
		});
	}

	onClose() {
		const {contentEl} = this;
		contentEl.empty();
	}
} 