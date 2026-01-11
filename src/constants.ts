/**
 * 插件常量定义
 */
export const CONSTANTS = {
    // 资源文件夹后缀 - 已废弃，但为了兼容性或默认值可能还需保留？
    // 实际上我们现在完全依赖 settings.imageAttachmentLocation
    // 但如果有地方作为 fallback，最好还是保留一个默认值引用
    DEFAULT_ASSETS_SUFFIX: '__assets',

    // 图片扩展名列表
    IMAGE_EXTENSIONS: ['.png', '.jpg', '.jpeg', '.gif', '.svg', '.webp', '.bmp'],

    // 视频扩展名列表（为未来扩展准备）
    VIDEO_EXTENSIONS: ['.mp4', '.webm', '.ogv', '.mov'],

    // 音频扩展名列表（为未来扩展准备）
    AUDIO_EXTENSIONS: ['.mp3', '.wav', '.ogg', '.flac', '.m4a'],

    // DOM选择器
    SELECTORS: {
        FILE_EXPLORER: '.nav-files-container, .workspace-leaf-content[data-type="file-explorer"]',
        // IMAGE_FOLDERSSelector 已移除，改为使用类名
        DOCUMENT_WITH_IMAGES: '.has-images',
        IMAGE_CONTAINER: '.document-images-container',
        EXPAND_INDICATOR: '.image-expand-indicator'
    },

    // DOM类名和ID
    STYLE_ELEMENT_ID: 'enhanced-publisher-styles',
    CONTAINER_CLASS: 'document-images-container',
    INDICATOR_CLASS: 'image-expand-indicator',
    HAS_IMAGES_CLASS: 'has-images',

    // 其他配置
    DEBOUNCE_DELAY: 100,  // 防抖延迟时间，单位毫秒

    // 事件名称
    EVENTS: {
        REFRESH_CONTAINERS: 'enhanced-publisher:refresh-containers',
        TOGGLE_ALL_CONTAINERS: 'enhanced-publisher:toggle-all-containers'
    },

    // 图片类型和文件扩展名映射
    IMAGE_TYPE_MAP: {
        'image/png': 'png',
        'image/jpeg': 'jpg',
        'image/jpg': 'jpg',
        'image/gif': 'gif',
        'image/svg+xml': 'svg',
        'image/webp': 'webp',
        'image/bmp': 'bmp'
    },

    // 文件扩展名和MIME类型映射
    MIME_TYPE_MAP: {
        'png': 'image/png',
        'jpg': 'image/jpeg',
        'jpeg': 'image/jpeg',
        'gif': 'image/gif',
        'svg': 'image/svg+xml',
        'webp': 'image/webp',
        'bmp': 'image/bmp'
    }
};