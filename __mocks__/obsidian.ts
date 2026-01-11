export class Notice {
    constructor(message: any, duration?: any) {
        // console.log(`Notice: ${message}`);
    }
}

export class TFile {
    parent: any;
    path: string;
    basename: string;
    extension: string;

    constructor() {
        this.parent = { path: '/' };
        this.path = '/mock/file.md';
        this.basename = 'file';
        this.extension = 'md';
    }
}

export class App {
    vault: any;

    metadataCache: any;

    constructor() {
        this.vault = {
            getAbstractFileByPath: jest.fn(),
            getFiles: jest.fn().mockReturnValue([]),
            readBinary: jest.fn(),
            read: jest.fn(),
            modify: jest.fn(),
            create: jest.fn(),
            createFolder: jest.fn(),
            adapter: {
                exists: jest.fn().mockReturnValue(Promise.resolve(false)),
                write: jest.fn().mockReturnValue(Promise.resolve())
            }
        };
        this.metadataCache = {
            getFirstLinkpathDest: jest.fn(),
            getFileCache: jest.fn()
        };
    }
}


export class ItemView {
    constructor() { }
}

export class Plugin {
    constructor() { }
}

export class Setting {
    constructor() { }
    setName() { return this; }
    setDesc() { return this; }
    addText() { return this; }
    addTextArea() { return this; }
    addToggle() { return this; }
}

export class Modal {
    constructor() { }
    open() { }
    close() { }
}

export const requestUrl = jest.fn();

export const parseYaml = jest.fn();
export const stringifyYaml = jest.fn();
