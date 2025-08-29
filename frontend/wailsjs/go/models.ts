export namespace main {
	
	export class SubtitleEntry {
	    index: number;
	    timestamp: string;
	    startTime: string;
	    endTime: string;
	    english: string;
	    chinese?: string;
	
	    static createFrom(source: any = {}) {
	        return new SubtitleEntry(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.index = source["index"];
	        this.timestamp = source["timestamp"];
	        this.startTime = source["startTime"];
	        this.endTime = source["endTime"];
	        this.english = source["english"];
	        this.chinese = source["chinese"];
	    }
	}

}

export namespace types {
	
	export class DependencyStatus {
	    ytdlp: boolean;
	    ffmpeg: boolean;
	    yap: boolean;
	
	    static createFrom(source: any = {}) {
	        return new DependencyStatus(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.ytdlp = source["ytdlp"];
	        this.ffmpeg = source["ffmpeg"];
	        this.yap = source["yap"];
	    }
	}
	export class Settings {
	    workspace: string;
	    sourceLang: string;
	    apiProvider: string;
	    apiKey: string;
	    summaryLength: string;
	    temperature: number;
	    maxTokens: number;
	
	    static createFrom(source: any = {}) {
	        return new Settings(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.workspace = source["workspace"];
	        this.sourceLang = source["sourceLang"];
	        this.apiProvider = source["apiProvider"];
	        this.apiKey = source["apiKey"];
	        this.summaryLength = source["summaryLength"];
	        this.temperature = source["temperature"];
	        this.maxTokens = source["maxTokens"];
	    }
	}
	export class Task {
	    id: string;
	    url: string;
	    videoId: string;
	    title: string;
	    channel: string;
	    duration: string;
	    thumbnail: string;
	    sourceLang: string;
	    status: string;
	    progress: number;
	    error?: string;
	    workDir: string;
	    // Go type: time
	    createdAt: any;
	    // Go type: time
	    updatedAt: any;
	    // Go type: time
	    completedAt?: any;
	
	    static createFrom(source: any = {}) {
	        return new Task(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.url = source["url"];
	        this.videoId = source["videoId"];
	        this.title = source["title"];
	        this.channel = source["channel"];
	        this.duration = source["duration"];
	        this.thumbnail = source["thumbnail"];
	        this.sourceLang = source["sourceLang"];
	        this.status = source["status"];
	        this.progress = source["progress"];
	        this.error = source["error"];
	        this.workDir = source["workDir"];
	        this.createdAt = this.convertValues(source["createdAt"], null);
	        this.updatedAt = this.convertValues(source["updatedAt"], null);
	        this.completedAt = this.convertValues(source["completedAt"], null);
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	export class VideoMetadata {
	    id: string;
	    title: string;
	    channel: string;
	    duration: number;
	    // Go type: time
	    publishedAt: any;
	    thumbnail: string;
	
	    static createFrom(source: any = {}) {
	        return new VideoMetadata(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.title = source["title"];
	        this.channel = source["channel"];
	        this.duration = source["duration"];
	        this.publishedAt = this.convertValues(source["publishedAt"], null);
	        this.thumbnail = source["thumbnail"];
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}

}

