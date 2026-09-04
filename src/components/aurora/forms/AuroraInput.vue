<script setup>
import { computed, useAttrs, useId } from 'vue'
defineOptions({ inheritAttrs: false })
const props=defineProps({modelValue:[String,Number],label:String,hint:String,error:String,id:String,type:{default:'text'},disabled:Boolean,multiline:Boolean,rows:{default:3},placeholder:String})
defineEmits(['update:modelValue'])
const attrs=useAttrs();const uid=useId();const controlId=computed(()=>props.id||`${uid}-control`);const messageId=`${uid}-message`
const describedBy=computed(()=>[attrs['aria-describedby'],(props.error||props.hint)?messageId:null].filter(Boolean).join(' ')||undefined)
</script>
<template><label class="field" :for="controlId"><span v-if="label">{{label}}</span><component :is="multiline?'textarea':'input'" v-bind="attrs" :id="controlId" :value="modelValue" :type="multiline?undefined:type" :rows="multiline?rows:undefined" :placeholder="placeholder" :disabled="disabled" :aria-invalid="error?'true':undefined" :aria-describedby="describedBy" :aria-errormessage="error?messageId:undefined" @input="$emit('update:modelValue',$event.target.value)"/><small :id="messageId" :class="{error}" :role="error?'alert':undefined">{{error||hint}}</small></label></template>
<style scoped>.field{display:grid;gap:7px;color:var(--text-secondary);font:600 13px/1.3 var(--font-core)}input,textarea{width:100%;min-height:48px;padding:12px 14px;border:1px solid var(--border-subtle);border-radius:var(--radius-md);outline:0;background:var(--surface-primary);color:var(--text-primary);font:400 15px/1.4 var(--font-core);resize:vertical}input:focus,textarea:focus{border-color:var(--border-accent)}small{min-height:1em;color:var(--text-muted);font-weight:400}.error{color:var(--status-destructive)}</style>
