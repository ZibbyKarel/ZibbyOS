// Only the engine and the chat feature's own affordances are exported. The overlay UI that
// replaced the old dock lives in `features/zibby` (`ZibbyHost`); ZB-13 deleted the old
// `Screen`/`ChatScreen` full-page view entirely — a barrel this narrow can't drag a whole view
// graph into every consumer or risk cycles.
export { ChatProvider, useChat, useOptionalChat } from "./ChatContext";
export { ChatAboutButton } from "./components/ChatAboutButton";
export type { ChatAboutButtonProps } from "./components/ChatAboutButton";
export { useSendChatMessageMutation } from "./mutations";
export { useChatTranscriptQuery, getChatTranscriptQueryKey } from "./queries";
export { useChatStream } from "./hooks/useChatStream";
export type { ChatStreamState, CompletedTurn, ChatStreamHandlers } from "./hooks/useChatStream";
export { useVoiceMode } from "./hooks/useVoiceMode";
export { VoiceToggleButton } from "./components/VoiceToggleButton";
export { VoiceStatusStrip } from "./components/VoiceStatusStrip";
