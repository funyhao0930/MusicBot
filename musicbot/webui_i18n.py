"""Traditional Chinese display strings for the local Web UI settings pages."""

from __future__ import annotations

from typing import Dict, Tuple


OptionTranslation = Tuple[str, str]


CONFIG_SECTION_LABELS: Dict[str, str] = {
    "Credentials": "帳號憑證",
    "Permissions": "基本權限",
    "Chat": "聊天與頻道",
    "MusicBot": "機器人功能",
    "Files": "檔案與儲存",
    "WebUI": "網頁控制台",
}


PERMISSION_GROUP_LABELS: Dict[str, str] = {
    "owner": "擁有者",
    "default": "預設",
}


CONFIG_OPTION_TRANSLATIONS: Dict[str, OptionTranslation] = {
    "DebugLevel": (
        "除錯層級",
        "設定 MusicBot 日誌的詳細程度。一般使用建議維持 INFO。",
    ),
    "Token": (
        "Discord 機器人權杖",
        "用來登入 Discord 的機器人權杖。請勿公開或分享此值。",
    ),
    "Spotify_ClientID": (
        "Spotify 用戶端 ID",
        "選填。填入 Spotify Client ID 後可啟用 Spotify API 功能。",
    ),
    "Spotify_ClientSecret": (
        "Spotify 用戶端密鑰",
        "選填。搭配 Spotify Client ID 使用，請勿公開此密鑰。",
    ),
    "OwnerID": (
        "擁有者 Discord ID",
        "指定機器人擁有者的 Discord 使用者 ID，也可填入 auto 自動判定。",
    ),
    "DevIDs": (
        "開發者 Discord ID",
        "可使用開發者專用遠端執行指令的使用者 ID 清單。非開發用途請留空。",
    ),
    "BotExceptionIDs": (
        "其他機器人例外 ID",
        "MusicBot 不應忽略的其他 Discord 機器人成員 ID。預設會忽略所有機器人。",
    ),
    "CommandPrefix": (
        "指令前綴",
        "所有 MusicBot 指令開頭必須使用的符號或文字。",
    ),
    "CommandUsageNotice": (
        "指令回應提醒",
        "附加在聊天指令回應後的文字；留空即可停用。",
    ),
    "CommandsByMention": (
        "允許提及機器人下指令",
        "允許使用 @機器人名稱 取代指令前綴；原本的指令前綴仍可使用。",
    ),
    "BindToChannels": (
        "限定文字頻道",
        "只允許在指定的文字頻道使用 MusicBot 指令。留空時可在所有頻道使用。",
    ),
    "AllowUnboundServers": (
        "允許未綁定的伺服器",
        "當伺服器未設定限定頻道時，允許 MusicBot 回應所有文字頻道。",
    ),
    "AutojoinChannels": (
        "啟動時自動加入的語音頻道",
        "MusicBot 啟動後會自動加入的語音頻道 ID 清單。",
    ),
    "DMNowPlaying": (
        "私訊正在播放通知",
        "優先私訊點歌者播放通知，而不是將通知張貼到伺服器頻道。",
    ),
    "DisableNowPlayingAutomatic": (
        "停用自動播放清單通知",
        "播放自動播放清單歌曲時，不傳送正在播放通知。",
    ),
    "NowPlayingChannels": (
        "指定播放通知頻道",
        "強制每個伺服器使用指定文字頻道傳送正在播放通知。",
    ),
    "DeleteNowPlaying": (
        "自動刪除播放通知",
        "MusicBot 會自動刪除自己傳送的正在播放訊息。",
    ),
    "DefaultVolume": (
        "預設音量",
        "設定歌曲開始播放時的預設音量，範圍為 0 到 1。",
    ),
    "DefaultSpeed": (
        "預設播放速度",
        "設定歌曲的預設播放速度。FFmpeg 可用範圍為 0.5 到 100。",
    ),
    "SkipsRequired": (
        "跳過歌曲所需票數",
        "跳過歌曲至少需要的投票人數；若跳過比例需要更多票，會採用較高門檻。",
    ),
    "SkipRatio": (
        "跳過歌曲所需比例",
        "必須投票跳過的聽眾比例；若固定票數門檻較低，會採用固定票數。",
    ),
    "SaveVideos": (
        "保留下載的媒體",
        "決定播放後保留已下載的媒體，或立即刪除。",
    ),
    "StorageLimitBytes": (
        "媒體快取容量上限",
        "啟用保留下載媒體時，限制快取可使用的儲存空間。",
    ),
    "StorageLimitDays": (
        "媒體快取保留天數",
        "啟用保留下載媒體時，限制檔案可保留的最長天數。",
    ),
    "StorageRetainAutoPlay": (
        "永遠保留自動播放歌曲",
        "啟用保留下載媒體時，不從快取清除自動播放清單的歌曲。",
    ),
    "NowPlayingMentions": (
        "播放時提及點歌者",
        "歌曲開始播放時提及加入該歌曲的使用者。",
    ),
    "AutoSummon": (
        "啟動時自動加入擁有者",
        "MusicBot 啟動時，若擁有者位於可存取的語音頻道便自動加入。",
    ),
    "UseAutoPlaylist": (
        "啟用自動播放清單",
        "允許 MusicBot 自動播放 autoplaylist.txt 中的歌曲。",
    ),
    "AutoPlaylistRandom": (
        "隨機排列自動播放清單",
        "播放前隨機打亂自動播放清單中的歌曲順序。",
    ),
    "AutoPlaylistAutoSkip": (
        "點歌時跳過自動播放歌曲",
        "使用者加入新歌曲時，自動跳過目前由自動播放清單加入的歌曲。",
    ),
    "AutoPlaylistRemoveBlocked": (
        "移除被封鎖的自動播放歌曲",
        "自動播放清單歌曲若符合歌曲封鎖清單，便將其移除。",
    ),
    "AutoPause": (
        "無人收聽時自動暫停",
        "沒有使用者收聽時，MusicBot 會自動暫停播放。",
    ),
    "DeleteMessages": (
        "自動刪除機器人訊息",
        "短暫延遲後，自動刪除 MusicBot 傳送的訊息。",
    ),
    "DeleteInvoking": (
        "自動刪除有效指令",
        "短暫延遲後，自動刪除使用者傳送且有效的指令訊息。",
    ),
    "PersistentQueue": (
        "保存播放佇列",
        "儲存歌曲佇列，使其在 MusicBot 重新啟動後仍能保留。",
    ),
    "PreDownloadNextSong": (
        "預先下載下一首歌",
        "播放目前歌曲時預先下載佇列中的下一首；不適用於自動播放或空佇列的第一首歌。",
    ),
    "StatusMessage": (
        "自訂狀態訊息",
        "設定機器人的自訂狀態。留空時會顯示目前播放資訊，並支援播放器與歌曲變數。",
    ),
    "StatusIncludePaused": (
        "狀態包含已暫停播放器",
        "在狀態訊息中計入目前處於暫停狀態的播放器。",
    ),
    "WriteCurrentSong": (
        "寫入目前歌曲名稱",
        "將目前歌曲標題寫入 data/{server_ID}/current.txt。",
    ),
    "AllowAuthorSkip": (
        "允許點歌者直接跳過",
        "允許歌曲點播者略過投票，直接跳過自己點的歌曲。",
    ),
    "UseExperimentalEqualization": (
        "使用實驗性音量正規化",
        "嘗試透過 FFmpeg 取得並套用播放音量正規化參數。",
    ),
    "UseEmbeds": (
        "使用嵌入式訊息",
        "允許 MusicBot 使用 Discord 嵌入式訊息格式。",
    ),
    "QueueLength": (
        "佇列每頁顯示數量",
        "使用佇列指令列出歌曲時，每頁顯示的項目數量。",
    ),
    "RemoveFromAPOnError": (
        "錯誤時移除自動播放項目",
        "自動從自動播放清單移除無法播放的項目。",
    ),
    "ShowConfigOnLaunch": (
        "啟動時顯示設定",
        "MusicBot 啟動時將目前設定內容輸出到日誌。",
    ),
    "LegacySkip": (
        "使用傳統跳過機制",
        "使用舊版跳過投票行為，並配合權限群組的立即跳過設定。",
    ),
    "LeaveServersWithoutOwner": (
        "離開沒有擁有者的伺服器",
        "若伺服器成員名單中沒有機器人擁有者，MusicBot 會離開該伺服器。",
    ),
    "UseAlias": (
        "啟用指令別名",
        "允許使用 config/aliases.json 為指令設定多個名稱。",
    ),
    "CustomEmbedFooter": (
        "自訂嵌入訊息頁尾",
        "啟用嵌入式訊息時，以自訂文字取代頁尾的 MusicBot 名稱與版本。",
    ),
    "SelfDeafen": (
        "進入語音頻道時自行拒聽",
        "MusicBot 加入語音頻道時自動將自己設為拒聽。",
    ),
    "LeaveInactiveVC": (
        "離開閒置語音頻道",
        "無人收聽時等待指定時間，然後自動離開語音頻道。",
    ),
    "LeaveInactiveVCTimeOut": (
        "閒置語音頻道等待時間",
        "無人收聽後等待多久才離開語音頻道。設定為 0 可停用。",
    ),
    "LeaveAfterQueueEmpty": (
        "佇列清空後立即離開",
        "歌曲佇列變空時立即離開目前語音頻道。",
    ),
    "LeavePlayerInactiveFor": (
        "播放器閒置離開時間",
        "播放器未播放或處於暫停時，等待多久才離開語音頻道。設定為 0 可停用。",
    ),
    "SearchList": (
        "以訊息選擇搜尋結果",
        "搜尋歌曲時要求使用者傳送訊息選擇結果，而不是使用表情符號。",
    ),
    "DefaultSearchResults": (
        "預設搜尋結果數量",
        "搜尋指令未指定數量時，預設取得的搜尋結果筆數。",
    ),
    "EnablePrefixPerGuild": (
        "啟用伺服器專屬前綴",
        "允許每個伺服器儲存自己的指令前綴，並啟用設定前綴指令。",
    ),
    "RoundRobinQueue": (
        "輪流播放點歌",
        "多人點歌時依使用者輪流播放，每位成員一次播放一首。",
    ),
    "EnableNetworkChecker": (
        "啟用網路連線檢查",
        "監控網路連線狀態，協助 MusicBot 在連線中斷後恢復運作。",
    ),
    "SavePlayedHistoryGlobal": (
        "儲存全域播放紀錄",
        "將 MusicBot 播放過的所有歌曲儲存到 history.txt。",
    ),
    "SavePlayedHistoryGuilds": (
        "儲存各伺服器播放紀錄",
        "依伺服器將播放過的歌曲儲存到 history-{guild_id}.txt。",
    ),
    "EnableLocalMedia": (
        "啟用本機媒體播放",
        "允許 MusicBot 播放設定之媒體資料夾內的本機檔案。",
    ),
    "UnpausePlayerOnPlay": (
        "點歌時自動繼續播放",
        "播放器暫停時使用播放指令，MusicBot 會自動恢復播放。",
    ),
    "YtdlpProxy": (
        "yt-dlp 代理伺服器",
        "實驗性 HTTP/HTTPS 代理設定，會傳給 yt-dlp 與連結檢查。留空可停用。",
    ),
    "YtdlpUserAgent": (
        "yt-dlp 使用者代理字串",
        "實驗性設定。指定固定 User-Agent；留空時使用動態產生的預設值。",
    ),
    "YtdlpUseOAuth2": (
        "啟用 yt-dlp OAuth2",
        "讓 yt-dlp 透過 OAuth2 授權 YouTube 帳號。不可與 Cookie 登入同時使用。",
    ),
    "YtdlpOAuth2ClientID": (
        "YouTube OAuth2 用戶端 ID",
        "選填。供 yt-dlp OAuth2 外掛使用的 YouTube API Client ID。",
    ),
    "YtdlpOAuth2ClientSecret": (
        "YouTube OAuth2 用戶端密鑰",
        "選填。搭配 YouTube OAuth2 Client ID 使用，請勿公開此密鑰。",
    ),
    "YtdlpOAuth2URL": (
        "OAuth2 啟動測試影片網址",
        "選填。啟動時用指定 YouTube 影片觸發 OAuth2 授權，完成後才繼續啟動。",
    ),
    "EnableUserBlocklist": (
        "啟用使用者封鎖清單",
        "啟用使用者封鎖功能，不會清空既有封鎖清單。",
    ),
    "UserBlocklistFile": (
        "使用者封鎖清單檔案",
        "選填。每行一個 Discord 使用者 ID 的文字檔路徑。",
    ),
    "EnableSongBlocklist": (
        "啟用歌曲封鎖清單",
        "啟用歌曲封鎖功能，不會清空既有封鎖清單。",
    ),
    "SongBlocklistFile": (
        "歌曲封鎖清單檔案",
        "選填。每行一個網址、單字或詞句；歌曲標題或網址包含內容時會被封鎖。",
    ),
    "AutoPlaylistDirectory": (
        "自動播放清單資料夾",
        "選填。存放自動播放清單檔案的資料夾，每行一個可播放網址或搜尋詞。",
    ),
    "MediaFileDirectory": (
        "本機媒體資料夾",
        "選填。存放可播放本機媒體的資料夾，可透過 file:// 路徑存取。",
    ),
    "i18nFile": (
        "語言檔路徑",
        "選填。指定 MusicBot 使用的 i18n 語言檔；此設定未來可能變更。",
    ),
    "AudioCachePath": (
        "音訊快取資料夾",
        "選填。MusicBot 儲存短期與長期播放快取的資料夾。",
    ),
    "LogsMaxKept": (
        "日誌保留數量上限",
        "重新啟動時自動輪替日誌並限制保留數量。設定為 0 表示停用輪替。",
    ),
    "LogsDateFormat": (
        "日誌日期格式",
        "啟用日誌輪替時使用的日期格式，採用 Python strftime 格式代碼。",
    ),
    "WebUIEnabled": (
        "啟用網頁控制台",
        "啟用本機 MusicBot 瀏覽器控制中心。",
    ),
    "WebUIHost": (
        "網頁控制台主機位址",
        "本機瀏覽器控制中心使用的主機位址，只接受 127.0.0.1 或 localhost。",
    ),
    "WebUIPort": (
        "網頁控制台連接埠",
        "本機瀏覽器控制中心使用的 TCP 連接埠。",
    ),
    "WebUIAutoOpen": (
        "啟動時開啟網頁控制台",
        "MusicBot 啟動時自動開啟本機瀏覽器控制中心。",
    ),
    "WebUIPublicEnabled": (
        "啟用公開代理 API",
        "啟用僅供 HTTPS 代理使用、受權杖保護的本機 API。",
    ),
    "WebUIPublicPort": (
        "公開代理 API 連接埠",
        "受權杖保護的本機 API 所使用的 TCP 連接埠。",
    ),
}


PERMISSION_OPTION_TRANSLATIONS: Dict[str, OptionTranslation] = {
    "CommandWhitelist": (
        "允許的指令清單",
        "以空白分隔可使用的指令名稱。設定後會覆蓋禁止指令清單。",
    ),
    "CommandBlacklist": (
        "禁止的指令清單",
        "以空白分隔禁止使用的指令名稱。若已設定允許指令清單，此項不會生效。",
    ),
    "IgnoreNonVoice": (
        "必須同語音頻道的指令",
        "以空白分隔只能在與 MusicBot 相同語音頻道時使用的指令名稱。",
    ),
    "GrantToRoles": (
        "套用此群組的身分組 ID",
        "取得此權限群組的 Discord 伺服器身分組 ID 清單；設定使用者清單時會忽略此項。",
    ),
    "UserList": (
        "套用此群組的使用者 ID",
        "取得此權限群組的 Discord 成員 ID 清單，並會覆蓋身分組設定。",
    ),
    "MaxSongs": (
        "歌曲排隊上限",
        "每位使用者最多可加入佇列的歌曲數量。設定為 0 表示不限。",
    ),
    "MaxSongLength": (
        "單曲長度上限",
        "允許的歌曲最長秒數。設定為 0 表示不限；無法取得歌曲長度時可能不會套用。",
    ),
    "MaxPlaylistLength": (
        "播放清單歌曲數上限",
        "單次可加入佇列的播放清單最大歌曲數。設定為 0 表示不限。",
    ),
    "MaxSearchItems": (
        "搜尋結果數量上限",
        "一次搜尋最多可回傳的結果數量。",
    ),
    "AllowPlaylists": (
        "允許加入播放清單",
        "允許使用者一次加入播放清單或多首歌曲。",
    ),
    "InstaSkip": (
        "允許立即跳過",
        "啟用傳統跳過機制時，允許使用者不經投票直接跳過歌曲。",
    ),
    "SkipLooped": (
        "允許跳過循環歌曲",
        "允許使用者跳過目前正在循環播放的歌曲。",
    ),
    "Remove": (
        "允許移除佇列歌曲",
        "允許使用者移除佇列中的任意歌曲，但不會移除或跳過目前播放中的歌曲。",
    ),
    "SkipWhenAbsent": (
        "點歌者不在時跳過",
        "歌曲開始播放時，若點歌者不在語音頻道便跳過該歌曲。",
    ),
    "BypassKaraokeMode": (
        "允許略過卡拉 OK 模式限制",
        "啟用卡拉 OK 模式時，仍允許使用者將歌曲加入佇列。",
    ),
    "SummonNoVoice": (
        "播放時自動加入使用者頻道",
        "MusicBot 尚未在語音頻道時，使用播放指令會自動加入使用者所在頻道。",
    ),
    "Extractors": (
        "允許的媒體來源",
        "以空白分隔允許使用的 yt-dlp 解析器名稱。留空時使用內建預設來源。",
    ),
}


def localize_permission_group(name: str) -> str:
    """Return a localized protected group name, or the original custom name."""
    return PERMISSION_GROUP_LABELS.get(name.lower(), name)


def localize_option(section: str, option: str, comment: str) -> Tuple[str, str, str]:
    """Return localized section, option label, and description for Web UI display."""
    if option in CONFIG_OPTION_TRANSLATIONS:
        display_section = CONFIG_SECTION_LABELS.get(section, section)
        display_option, display_comment = CONFIG_OPTION_TRANSLATIONS[option]
    elif option in PERMISSION_OPTION_TRANSLATIONS:
        display_section = localize_permission_group(section)
        display_option, display_comment = PERMISSION_OPTION_TRANSLATIONS[option]
    else:
        display_section = CONFIG_SECTION_LABELS.get(
            section, localize_permission_group(section)
        )
        display_option = option
        display_comment = comment or "沒有額外說明"

    return display_section, display_option, display_comment
