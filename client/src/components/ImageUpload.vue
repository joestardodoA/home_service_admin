<template>
  <div class="image-upload">
    <!-- 已上传的预览 -->
    <div class="preview-list">
      <div v-for="(url, idx) in fileList" :key="idx" class="preview-item">
        <img :src="getFullUrl(url)" class="preview-img" @click="previewImage(url)" />
        <div class="preview-delete" @click="removeFile(idx)">
          <el-icon><Close /></el-icon>
        </div>
      </div>
      <!-- 上传按钮 -->
      <div v-if="fileList.length < maxCount" class="upload-trigger" @click="triggerUpload">
        <el-icon class="upload-icon"><Plus /></el-icon>
        <span class="upload-text">{{ placeholder }}</span>
      </div>
    </div>
    <!-- 隐藏的文件选择器 -->
    <input ref="fileInput" type="file" :accept="accept" :multiple="multiple" style="display: none" @change="handleFileChange" />
    <!-- 上传进度 -->
    <el-progress v-if="uploading" :percentage="progress" :stroke-width="3" style="margin-top: 8px" />
  </div>
</template>

<script setup>
/**
 * ImageUpload — 通用图片上传组件
 *
 * 用法:
 *   <ImageUpload v-model="form.icon" placeholder="上传图标" />
 *   <ImageUpload v-model="form.gallery" :multiple="true" :max-count="9" placeholder="上传相册" />
 *
 * Props:
 *   modelValue  — 绑定值。单图模式为 String（URL），多图模式为 Array<String>
 *   multiple    — 是否多图模式（默认 false = 单图）
 *   maxCount    — 最大上传数量（多图模式生效，默认 9）
 *   placeholder — 上传按钮文字
 *   accept      — 接受的文件类型
 */
import { ref, computed, watch } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import axios from 'axios'

const props = defineProps({
  modelValue: { type: [String, Array], default: '' },
  multiple: { type: Boolean, default: false },
  maxCount: { type: Number, default: 9 },
  placeholder: { type: String, default: '上传图片' },
  accept: { type: String, default: 'image/*' }
})

const emit = defineEmits(['update:modelValue'])

const fileInput = ref(null)
const uploading = ref(false)
const progress = ref(0)

// 内部统一用数组管理
const fileList = computed(() => {
  if (props.multiple) {
    return Array.isArray(props.modelValue) ? props.modelValue.filter(Boolean) : []
  }
  return props.modelValue ? [props.modelValue] : []
})

// 获取完整 URL（支持相对路径和绝对路径）
function getFullUrl(url) {
  if (!url) return ''
  if (url.indexOf('http') === 0) return url
  // 本地路径通过 Vite 代理访问
  return url
}

// 触发文件选择
function triggerUpload() {
  if (fileInput.value) {
    fileInput.value.value = ''
    fileInput.value.click()
  }
}

// 处理文件选择
async function handleFileChange(e) {
  const files = e.target.files
  if (!files || files.length === 0) return

  // 验证文件大小（5MB）
  for (let i = 0; i < files.length; i++) {
    if (files[i].size > 5 * 1024 * 1024) {
      ElMessage.error('文件 ' + files[i].name + ' 超过 5MB 限制')
      return
    }
  }

  uploading.value = true
  progress.value = 0

  try {
    if (props.multiple && files.length > 1) {
      // 多文件上传
      const formData = new FormData()
      for (let i = 0; i < files.length; i++) {
        formData.append('files', files[i])
      }
      const res = await axios.post('/api/upload/multi', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
          Authorization: 'Bearer ' + localStorage.getItem('token')
        },
        onUploadProgress: function(e) {
          if (e.total) progress.value = Math.round((e.loaded / e.total) * 100)
        }
      })
      if (res.data && res.data.code === 200) {
        const urls = res.data.data.map(f => f.url)
        const newList = [...fileList.value, ...urls].slice(0, props.maxCount)
        emit('update:modelValue', newList)
        ElMessage.success('上传成功')
      }
    } else {
      // 单文件上传
      const formData = new FormData()
      formData.append('file', files[0])
      const res = await axios.post('/api/upload', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
          Authorization: 'Bearer ' + localStorage.getItem('token')
        },
        onUploadProgress: function(e) {
          if (e.total) progress.value = Math.round((e.loaded / e.total) * 100)
        }
      })
      if (res.data && res.data.code === 200) {
        const url = res.data.data.url
        if (props.multiple) {
          const newList = [...fileList.value, url].slice(0, props.maxCount)
          emit('update:modelValue', newList)
        } else {
          emit('update:modelValue', url)
        }
        ElMessage.success('上传成功')
      }
    }
  } catch (err) {
    ElMessage.error('上传失败: ' + (err.message || '网络错误'))
  } finally {
    uploading.value = false
    progress.value = 0
  }
}

// 删除文件
function removeFile(idx) {
  if (props.multiple) {
    const newList = [...fileList.value]
    newList.splice(idx, 1)
    emit('update:modelValue', newList)
  } else {
    emit('update:modelValue', '')
  }
}

// 预览图片
function previewImage(url) {
  ElMessageBox.alert(
    '<img src="' + getFullUrl(url) + '" style="max-width: 100%; max-height: 60vh; display: block; margin: 0 auto;" />',
    '图片预览',
    { dangerouslyUseHTMLString: true, showConfirmButton: false, customClass: 'image-preview-dialog' }
  )
}
</script>

<style scoped>
.image-upload { width: 100%; }
.preview-list { display: flex; flex-wrap: wrap; gap: 8px; }
.preview-item {
  position: relative; width: 100px; height: 100px; border-radius: 6px;
  overflow: hidden; border: 1px solid #dcdfe6;
}
.preview-img {
  width: 100%; height: 100%; object-fit: cover; cursor: pointer;
}
.preview-delete {
  position: absolute; top: 2px; right: 2px; width: 20px; height: 20px;
  background: rgba(0,0,0,0.5); border-radius: 50%; display: flex;
  align-items: center; justify-content: center; cursor: pointer;
  color: #fff; font-size: 12px; transition: background 0.2s;
}
.preview-delete:hover { background: rgba(220,38,38,0.8); }
.upload-trigger {
  width: 100px; height: 100px; border: 1px dashed #dcdfe6; border-radius: 6px;
  display: flex; flex-direction: column; align-items: center; justify-content: center;
  cursor: pointer; transition: all 0.2s; color: #909399;
}
.upload-trigger:hover { border-color: #409eff; color: #409eff; }
.upload-icon { font-size: 24px; }
.upload-text { font-size: 12px; margin-top: 4px; }
</style>
