# 生活小達人：Google 試算表題庫

## 將題庫放到 Google 雲端

1. 在 Google 試算表建立題庫，第一列欄位請使用 `icon`、`label`、`answer`。
2. `icon` 只能填 `soap`、`recycle`、`tooth`、`umbrella`、`pot`、`crosswalk`；每一列都要有 `label` 和 `answer`。
3. 在試算表選「檔案」→「共用」→「發布到網路」，選擇題庫工作表，發布格式選 CSV，然後發布。
4. 複製 Google 提供的 CSV 公開網址，貼到 [sketch.js](./sketch.js) 最上方的 `CLOUD_CSV_URL`。
5. 重新載入遊戲。遊戲會直接從 Google 試算表讀取題庫，每回合隨機抽六題。

發布網址通常會以 `https://docs.google.com/spreadsheets/d/e/` 開頭。題庫必須公開發布才能讓遊戲讀取；不要把私人資料放在公開題庫中。留空 `CLOUD_CSV_URL` 時，遊戲會使用同資料夾的 `questions.csv` 作為本機開發題庫。

請透過 VS Code Live Server 或其他 HTTP 網頁伺服器開啟遊戲，不要直接用 `file://` 開啟；瀏覽器通常會限制網頁讀取本機檔案及 Google 試算表。
