import {
  AudioAttachmentRequest,
  FileAttachmentRequest,
  ImageAttachmentRequest,
  LocationAttachmentRequest,
  ShareAttachmentRequest,
  StickerAttachmentRequest,
  VideoAttachmentRequest,
} from '../network/api';

class Attachment {
  toJson() {
    throw new Error('Attachment not implemented.');
  }
}

export class MediaAttachment extends Attachment {
  readonly token?: string;

  constructor({ token }: { token?: string }) {
    super();
    this.token = token;
  }

  get payload(): object {
    return { token: this.token };
  }
}

export class VideoAttachment extends MediaAttachment {
  readonly type = 'video';

  toJson(): VideoAttachmentRequest {
    return {
      type: this.type,
      payload: this.payload,
    };
  }
}

export type ImagePhotos = {
  [key: string]: { token: string }
};

export class ImageAttachment extends MediaAttachment {
  readonly photos?: ImagePhotos;

  readonly url?: string;

  constructor(options:
  | { token?: string }
  | { photos?: ImagePhotos }
  | { url?: string }) {
    super({ token: 'token' in options ? options.token : undefined });
    if ('photos' in options) {
      this.photos = options.photos;
    }
    if ('url' in options) {
      this.url = options.url;
    }
  }

  get payload(): ImageAttachmentRequest['payload'] {
    if (this.token) {
      return { token: this.token };
    }
    if (this.url) {
      return { url: this.url };
    }
    return { photos: this.photos };
  }

  toJson(): ImageAttachmentRequest {
    return {
      type: 'image',
      payload: this.payload,
    };
  }
}

export class AudioAttachment extends MediaAttachment {
  toJson(): AudioAttachmentRequest {
    return {
      type: 'audio',
      payload: this.payload,
    };
  }
}

export class FileAttachment extends MediaAttachment {
  toJson(): FileAttachmentRequest {
    return {
      type: 'file',
      payload: this.payload,
    };
  }
}

export class StickerAttachment extends Attachment {
  readonly code: string;

  constructor({ code }: { code: string }) {
    super();
    this.code = code;
  }

  get payload(): StickerAttachmentRequest['payload'] {
    return { code: this.code };
  }

  toJson(): StickerAttachmentRequest {
    return {
      type: 'sticker',
      payload: this.payload,
    };
  }
}

export class LocationAttachment extends Attachment {
  readonly longitude: number;

  readonly latitude: number;

  constructor({ lon, lat }: {
    lon: number,
    lat: number,
  }) {
    super();
    this.longitude = lon;
    this.latitude = lat;
  }

  toJson(): LocationAttachmentRequest {
    return {
      type: 'location',
      latitude: this.latitude,
      longitude: this.longitude,
    };
  }
}

export class ShareAttachment extends Attachment {
  readonly url?: string;

  readonly token?: string;

  constructor({ url, token }: {
    url?: string;
    token?: string;
  } = {}) {
    super();
    this.url = url;
    this.token = token;
  }

  get payload() {
    return {
      url: this.url,
      token: this.token,
    };
  }

  toJson(): ShareAttachmentRequest {
    return {
      type: 'share',
      payload: this.payload,
    };
  }
}
