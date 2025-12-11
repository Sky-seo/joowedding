// communication.js
// 🚨 Apps Script Web App URL
const APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbzDAUzwVR9J73BhahX2y2gySw4YBYcUaZZagNLzC7CokiNUP8VC-KhVaV1C8Geq2HKw/exec';

// ✅ 최대 전송 효율을 위한 청크 크기 (약 35MB)
const CHUNK_SIZE = 25 * 1024 * 1024;

// Blob → base64 문자열로 변환
function blobToBase64(blob) {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const base64 = e.target.result.split(',')[1]; // data:*/*;base64,.... 뒷부분만
      resolve(base64);
    };
    reader.readAsDataURL(blob);
  });
}

// 파일 하나에 대한 업로드 세션 초기화
async function initUploadSession(file, userName) {
  const res = await fetch(APPS_SCRIPT_URL, {
    method: 'POST',
    body: JSON.stringify({
      action: 'init',
      name: file.name,
      mimeType: file.type,
      size: file.size,
      userName: userName
    })
  });

  const data = await res.json();
  if (!data.ok) {
    throw new Error(`Init Fail: ${data.error || 'Unknown error'}`);
  }

  return data.uploadUrl; // Apps Script에서 내려주는 업로드 URL
}

// 파일 하나를 청크 단위로 업로드
async function uploadSingleFileInChunks(file, fileIndex, totalFiles, userName, callbacks) {
  const { onStatus, onProgress } = callbacks || {};
  const fileSize = file.size;

  // 1. 초기화
  if (onStatus) {
    onStatus(`${fileIndex + 1}/${totalFiles}: ${file.name} 준비 중...`);
  }

  const uploadUrl = await initUploadSession(file, userName);

  // 2. 청크 업로드
  let offset = 0;

  while (offset < fileSize) {
    const chunkEnd = Math.min(offset + CHUNK_SIZE, fileSize);
    const chunkBlob = file.slice(offset, chunkEnd);

    const base64Data = await blobToBase64(chunkBlob);

    const percentForThisFile = (offset / fileSize) * 100;
    if (onStatus) {
      onStatus(
        `${fileIndex + 1}/${totalFiles}: ${file.name} 전송 중... (${Math.round(
          percentForThisFile
        )}%)`
      );
    }

    const chunkRes = await fetch(APPS_SCRIPT_URL, {
      method: 'POST',
      body: JSON.stringify({
        action: 'upload',
        uploadUrl: uploadUrl,
        chunkData: base64Data,
        offset: offset,
        fileSize: fileSize
      })
    });

    const chunkData = await chunkRes.json();
    if (!chunkData.ok) {
      throw new Error(`Chunk Upload Fail: ${chunkData.error || 'Unknown error'}`);
    }

    offset = chunkEnd;

    // 전체 진행률 (0~100) 계산
    const currentFilePercent = (offset / fileSize) * 100;
    const overallPercent =
      ((fileIndex * 100) + currentFilePercent) / totalFiles;

    if (onProgress) {
      onProgress(overallPercent);
    }
  }
}

// ✅ 외부에서 부를 메인 함수
// files: File[] 배열
// userName: string
// callbacks: { onStatus, onProgress, onComplete, onError }
async function uploadFilesChunked(files, userName, callbacks = {}) {
  const { onStatus, onProgress, onComplete, onError } = callbacks;

  try {
    const totalFiles = files.length;

    for (let i = 0; i < totalFiles; i++) {
      const file = files[i];
      await uploadSingleFileInChunks(file, i, totalFiles, userName, {
        onStatus,
        onProgress
      });
    }

    if (onComplete) {
      onComplete();
    }
  } catch (err) {
    console.error(err);
    if (onError) {
      onError(err);
    }
  }
}
