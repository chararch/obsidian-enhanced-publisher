import { TFile } from 'obsidian';

export type FilePathLike = {
    basename: string;
    parent: { path: string } | null;
};

/**
 * 根据模式和当前文件生成路径
 * @param pattern 路径模式，支持 ${filename} 占位符
 * @param file 当前文档文件
 * @returns 解析后的路径
 */
export function getPathFromPattern(pattern: string, file: FilePathLike): string {
    const parentPath = file.parent ? file.parent.path : '/';
    const filename = file.basename;

    // 替换 ${filename} 占位符
    let path = pattern.replace(/\$\{filename\}/g, filename);

    // 如果路径不以 / 开头，则相对于当前文档所在的文件夹
    // 但是，由于Obsidian的Vault路径通常是相对于根的
    // 我们需要处理两种情况：
    // 1. 如果路径模式生成的是绝对路径（不依赖当前文件夹），通常应该以 / 开头或者就是顶层文件夹
    // 2. 如果是相对路径，或者是默认的 ${filename}__assets，通常期望是在同级目录下

    // 为了简单和一致性，我们假设如果模式不包含 / 或者不是以 / 开头，它是相对于当前文档父目录的
    // 但是这里有一个特例：如果用户配置的是 "assets/${filename}"，这种通常是相对于根目录（或每级目录？）
    // 按照Obsidian的习惯，附件文件夹设置通常是相对于 Vault 根或者是相对于当前文件（子文件夹）

    // 我们采取如下策略：
    // 1. 如果 pattern 包含 ./ 或 ../，当做相对路径处理（虽然Obsidian Vault API不完全像文件系统，但我们尽力解析）
    // 2. 如果 pattern 是 ${filename}__assets 这种纯文件名形式，相对于当前文档父目录
    // 3. 如果 pattern 是 attachments/${filename} 这种包含路径分隔符但不是 ./ 开头的，通常认为是 Vault 根目录下的路径？
    //    不，用户可能希望在当前目录下创建一个 attachments 子目录。

    // 改正策略：
    // 始终将路径视为相对于文档父目录，除非它明确看起来像绝对路径?
    // 实际上，为了灵活性，我们可以让用户自己决定。
    // 但是为了兼容默认行為 `${filename}__assets` (在同级目录)，我们需要将解析后的路径拼接到 parentPath 后面

    // 让我们遵循最直观的逻辑：
    // 将解析后的 pattern 视为相对于 file.parent.path 的路径，除了它以 / 开头

    if (path.startsWith('/')) {
        return path.substring(1); // 返回相对于 Vault 根的路径（去掉了开头的 /）
    }

    // 处理相对路径逻辑
    // 如果 parentPath 是根目录 '/'，则直接返回 path
    if (parentPath === '/') {
        return path;
    }

    // 否则拼接到 parentPath
    return `${parentPath}/${path}`;
}
