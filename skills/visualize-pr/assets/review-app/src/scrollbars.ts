// Share the same treatment with the file tree and diff shadow roots.
export const scrollbarStyles = `
  * {
    scrollbar-width: thin;
    scrollbar-color: var(--scrollbar-thumb) transparent;
  }

  @supports selector(::-webkit-scrollbar) {
    * {
      scrollbar-width: auto;
      scrollbar-color: auto;
    }
    *::-webkit-scrollbar {
      width: 5px;
      height: 5px;
    }
    *::-webkit-scrollbar-track,
    *::-webkit-scrollbar-corner {
      background: transparent;
    }
    *::-webkit-scrollbar-thumb {
      background: var(--scrollbar-thumb);
      border-radius: 999px;
    }
    *::-webkit-scrollbar-thumb:hover {
      background: var(--scrollbar-thumb-hover);
    }
    *::-webkit-scrollbar-button {
      display: none;
      width: 0;
      height: 0;
    }
  }
`;
