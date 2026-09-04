<script setup>defineProps({label:{type:String,required:true},size:{default:'md'},variant:{default:'quiet'},active:Boolean,disabled:Boolean});defineEmits(['click'])</script>
<template><button class="a-icon" :class="[`a-icon--${size}`,`a-icon--${variant}`,{'a-icon--active':active}]" type="button" :aria-label="label" :aria-pressed="active||undefined" :disabled="disabled" @click="$emit('click',$event)"><slot/></button></template>
<style scoped>
.a-icon{display:grid;padding:0;place-items:center;border-radius:var(--radius-pill);color:var(--text-secondary);cursor:pointer;transition:background var(--dur-fast) var(--ease-calm),color var(--dur-fast) var(--ease-calm),transform var(--dur-instant) var(--ease-calm)}
.a-icon--sm{width:36px;height:36px}.a-icon--md{width:44px;height:44px}.a-icon--lg{width:52px;height:52px}
.a-icon--quiet{border:1px solid transparent;background:transparent}.a-icon--quiet:hover{background:var(--action-secondary-bg)}
.a-icon--outline{border:1px solid var(--border-subtle);background:transparent}.a-icon--outline:hover{background:var(--action-secondary-bg)}
.a-icon--solid{border:1px solid transparent;background:var(--action-primary);color:var(--action-primary-fg)}.a-icon--solid:hover{background:var(--action-primary-hover)}
.a-icon--active{color:var(--action-primary)}.a-icon:active:not(:disabled){transform:scale(.94)}.a-icon:disabled{opacity:.45;cursor:not-allowed}
</style>
