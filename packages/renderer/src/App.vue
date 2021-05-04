<template>
  <webview
    id="web-view"
    src="https://app.plex.tv/desktop"
    autosize
  />
</template>

<script lang="ts">
import {defineComponent} from 'vue';
export default defineComponent({
  name: 'App',
});
</script>

<style>
#app {
  font-family: Avenir, Helvetica, Arial, sans-serif;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  text-align: center;
  color: #2c3e50;
}

#web-view {
  width: 100vw;
  height: 100vh;
}

body {
  margin: 0;
}
</style>
