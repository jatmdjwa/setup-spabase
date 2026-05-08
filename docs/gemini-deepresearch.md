# **空港のデジタルトランスフォーメーション（DX）を加速させるマルチエージェントシステムの戦略的実装と高度活用シナリオに関する包括的分析**

## **第1章 序論：2026年の航空産業におけるパラダイムシフトと空港エコシステムの再定義**

世界の航空産業は、過去の未曾有の危機から完全に脱却し、2026年現在、かつてない規模の成長と同時に極めて複雑な運用上の課題に直面している。国際航空運送協会（IATA）が発表した2025年の年次報告によれば、世界の国際航空接続性（International Air Connectivity）は前年比で9%という力強い増加を記録し、主要100市場の大半がパンデミック以前の軌道を超える成長を見せている 1。また、国際空港評議会（ACI）が提供する「Annual World Airport Traffic Dataset 2025 Edition」は、世界180カ国・2,600以上の空港における旅客数（国内・国際）、航空貨物量、および航空機発着回数の急激な増加を追跡しており、2025年から2054年に向けた長期予測においても、世界的な航空需要の継続的な拡大が不可避であることを示唆している 2。

需要の急増は空港運営者に多大な収益機会をもたらす一方で、既存の物理的インフラストラクチャと人的資源に依存した運用モデルの限界を露呈させている。ACI Asia-Pacificの調査研究によれば、現代の空港が直面する主要な課題として、相互運用性のない旧時代的なインフラストラクチャ（Incompatible Infrastructure）、適切なデータアクセスの欠如（Not the Right Data）、デジタルトランスフォーメーションに対する組織的な抵抗（Organizational Resistance）、社会的懸念、そして新規投資に伴う重い財務的負担（Financial Burdens）が挙げられている 3。これらの課題を克服するため、空港は単なる物理的な通過点としての役割から脱却し、最新技術を活用してエコシステム全体を統合する「プラットフォーム提供者（Platform Provider）」および「イノベーションのイニシエーター（Initiator of Innovation）」へとその多面的な役割を変化させる必要がある 3。

この変革の中心に位置するのが、人工知能（AI）によるデジタルトランスフォーメーション（DX）である。しかし、2026年におけるAIの導入は、単一のタスクを効率化するための孤立したチャットボットや単発の予測モデルの実装という初期段階を既に終えている。現在進行している真のパラダイムシフトは、自律的に思考し行動する「AIエージェント（AI Agents）」が複数連携し、人間とシステムの間で複雑なタスクを協調して処理する「マルチエージェントシステム（Multi-Agent System: MAS）」の全面的な社会実装である。シンガポールのチャンギ空港や韓国の仁川（インチョン）国際空港に代表される先進事例では、組織自体が「エージェンティック・オーガニゼーション（Agentic Organization）」へと進化を遂げており、AIは人間の意思決定を単に支援するコパイロット（副操縦士）の枠を超え、自律的なスーパーエージェンシーとしての能力を発揮し始めている 4。本報告書は、AIエージェントチームの基盤となるアーキテクチャから、旅客サービス、グランドハンドリング、航空貨物における具体的な活用シナリオ、そして厳格化する国際的な法規制とガバナンス要件に至るまで、次世代スマート空港の実現に向けた包括的な分析を提供する。

## **第2章 次世代空港DXを支えるマルチエージェント・アーキテクチャの技術基盤**

空港という環境は、航空会社、グランドハンドラー、リテール事業者、出入国管理当局など、利害関係の異なる無数のステークホルダーがリアルタイムで交差する極めて動的なエコシステムである。この複雑性を単一の巨大な大規模言語モデル（LLM）によって制御しようとするアプローチは、構造的な限界を抱えている。

### **2.1 AIエージェントの基本構造とコンテキスト管理の限界突破**

すべての責任を単一のLLMに負わせるモノリシックなシステム設計は、モデルのコンテキストウィンドウの枯渇を招き、特定のドメインにおける深い専門性を確保することが困難となるばかりか、スケーラビリティを著しく阻害する 5。このボトルネックを解消するために台頭したのが、ワークフローを細分化し、それぞれに特化した自律的ソフトウェア単位である「AIエージェント」を分散配置するアプローチである。

AIエージェントは、従来のチャットボットとは一線を画す4つのコア能力を備えている。第一に、外部のAPIやセンサー、ユーザー入力から環境を「知覚（Perceive）」する能力。第二に、収集した情報をLLMの推論能力を用いて解釈し、戦略を決定する「推論（Reason）」の能力。第三に、外部ツールを呼び出して具体的な処理を実行する「行動（Act）」の能力。そして第四に、実行結果から学習し将来の意思決定を最適化する「学習（Learn）」の能力である 5。チャットボットがセッションごとに状態をリセットするのに対し、AIエージェントは長期的な記憶（State）を維持し、過去の相互作用を踏まえた上で次のステップを計画する自律性を持つため、空港における長期的かつ多段階の業務プロセスの管理に極めて適している 5。

### **2.2 エージェント間通信プロトコル（A2A）による自律的オーケストレーション**

複数の専門エージェントが連携して空港運営全体を最適化するためには、それらを統合する「オーケストレーション」の仕組みが不可欠である。初期のシステムでは中央のオーケストレーターがすべてのタスクを割り当てていたが、現在ではGoogleなどが提唱する「A2A（Agent-to-Agent）」プロトコルのようなオープン標準規格が導入され、ピアツーピア（P2P）での直接的な協調が可能となっている 5。

A2Aプロトコルは、HTTPおよびJSON-RPCを基盤として構築されており、ベンダーの異なるプラットフォーム間でも、エージェント同士がテキスト、音声、映像などのマルチモーダルなデータを安全に送受信することを可能にする 6。このアーキテクチャにおいて、各エージェントは自身の能力や提供可能な機能を記述した「エージェントカード（Agent Card）」を公開する 6。例えば、「企業フライトリクエストエージェント」「空港ナレッジベースエージェント」「フライト検索エージェント」といった異なる役割を持つエージェント群が、必要に応じて相手を動的に発見し、情報を要求・提供する標準化されたメッセージングを行う 7。

空港の運用シナリオにこれを適用すると、旧来のアプリケーション・プログラミング・インターフェース（API）を用いた静的な点と点の結合（ポイント・ツー・ポイント接続）から、意味論的（セマンティック）な通信網へと進化する 8。これは都市の交通網に例えられる。APIが単なる「道路」であるとすれば、A2Aプロトコルは信号機や交通管制システムを含む「インフラストラクチャ全体」であり、複雑な環境下でもエージェントという車両が衝突することなく目的地に到達できるよう調整する機能を持つ 8。

### **2.3 デジタルツインプラットフォームと生成系マルチエージェント（MAGS）の融合**

物理的な空港インフラとAIエージェントをシームレスに接続する仮想空間の「盤面」として機能するのが、デジタルツインプラットフォームである。Digital Twin Consortium（DTC）は、デジタルツインと生成AIを融合させた「マルチエージェント生成AIシステム（Multi-agent GenAI Systems: MAGS）」の概念を提唱し、自動車、インフラ、製造業だけでなく、航空産業においてもその実装を推進している 9。

MAGS環境下では、複数の生成AIベースのエージェントが並列してタスクを実行し、自己組織化・自己最適化を行う 9。空港のデジタルツインは単一の層ではなく、滑走路やターミナル、エネルギー網を接続する「内部レベル」、マルチモーダルなモビリティ（鉄道やバス等）と物流チェーンを統合する「ローカルレベル」、そして国際的な安全基準や手順を整合させる「グローバルレベル」という多層的なガバナンスと運用ロジックによって構築される 10。例えば、オランダのスキポール空港ピアHにおけるAnyLogicを用いたマルチメソッド・シミュレーションや 11、日本におけるNTTデータ数理システムの「S4 Simulation System」を活用した関西広域都市交通および屋内人流のデジタルツイン開発において、マルチエージェント・シミュレーションを通じた定量的評価と最適化が実証されている 12。

空港のデジタルツインにおいてAIエージェントチームは、「What-if（もしも）」のシナリオ分析を自律的に実行する。因果グラフ（Causal Graphs）を利用して、天候の急変やドローンの不正侵入といった過去のインシデントデータがゲートプランニングや旅客ボリュームに与える影響をシミュレーションし、その推論プロセスを透明性のある形でオペレーターに提示する 14。さらに、モデル蒸留（Model Distillation）技術を用いることで、複雑な群衆シミュレーションの結果をスタッフの訓練や現場でのコミュニケーションに活用しやすい形式へと簡略化・最適化することも可能である 14。

| 比較項目 | 従来の空港ITインフラ（API中心） | MAGSデジタルツイン・アーキテクチャ（A2A中心） |
| :---- | :---- | :---- |
| **システム連携の性質** | ハードコードされた静的接続 | エージェントカードに基づく動的・意味論的連携 6 |
| **データ処理パラダイム** | 事後的な集計とバッチ処理 | デジタルツイン上でのリアルタイム因果シミュレーション 14 |
| **例外処理への対応** | 事前に定義されたエラーハンドリング | エージェント間の交渉（Negotiation）による自律的再構築 9 |
| **意思決定の所在** | 人間がダッシュボードを見て判断 | エージェントによる分散処理と人間への最適解の提案 9 |

また、航空管制やサイバーセキュリティといったミッションクリティカルな領域においては、データを外部のパブリッククラウドに送信することなく、オンプレミス環境で確定的レイテンシ（Deterministic Latency）を保証しながら推論を実行するエッジAIの導入が不可欠である。DTCと米国航空宇宙研究技術パーク（NARTP）の協業では、AMD Ryzen AIのハイブリッドNPU（Neural Processing Unit）/GPUエッジコンピューティングや、Rowan大学のPythiaスーパーコンピュータ（物理法則に基づくAIインフラ）を活用し、データ主権（Data Sovereignty）を維持したままマルチエージェントシステムを航空システムに統合するアーキテクチャの検証が進められている 15。

## **第3章 旅客体験の再定義と非航空系収入（Non-aeronautical Revenue）の最大化シナリオ**

空港経営における最大の命題の一つは、航空会社からの着陸料や施設使用料といった「航空系収入」に依存する構造から脱却し、リテール（小売）、飲食（F\&B）、駐車、免税店等から得られる「非航空系収入」を最大化することである。近年、非航空系収入の飛躍的増加（一部のデータでは最大85%の増加可能性も指摘される）を達成するためには、旅客の滞在時間を単なる「待機によるフラストレーション」から「積極的な消費機会」へと転換させることが必須となっている 17。AIエージェントチームは、この転換を達成するための最も強力なエンジンとして機能する。

### **3.1 サイレント・コンシェルジュとシームレスなカスタマージャーニーの実現**

シンガポールのチャンギ空港は、「SMART Airport Vision」の下、デジタルファクトリー「DIVA（Digital, Innovation, Ventures and Analytics）」を設立し、AI、データ分析、オートメーションを駆使して旅客の事前到着から出発後までのエンドツーエンドのエンゲージメントを変革している 18。チャンギ空港のこの取り組みは、旅客トラフィックがパンデミック以前の水準を上回り、世界170以上の都市に接続される中、第13回Skytrax World’s Best Airportの称号を獲得する原動力となった 20。同空港は、次世代アーキテクチャであるEnterprise Digital Hub（EDH）への投資を通じ、航空業界におけるデジタルトランスフォーメーションの世界的ロールモデルとなることを目指している 21。

この変革の最前線にあるのが、「サイレント・コンシェルジュ（Silent Concierge）」という概念の具現化である。仁川国際空港などで導入が進むこのアプローチは、AIエージェントが旅客の背後にある見えないデジタルレイヤーとして機能し、旅客のニーズを事前に予測（Anticipate）するものである 15。例えば、フライトの遅延が確定した瞬間、フライト管理エージェントが旅客パーソナライゼーション・エージェントに通知（A2A通信）を送る。情報を受け取ったエージェントは、旅客が自らアプリを開いて操作する前に、空港内のディナーの予約時間を自動で変更し、さらに目的地のホテルに対してチェックイン時間の変更手続きをバックグラウンドで完了させる 15。この摩擦のない（Frictionless）統合は、旅行のロジスティクスに伴う心理的負担を排除し、旅客に「時間的・精神的な余白」を与えることで、空港内の免税店やダイニングエリアでの消費行動を自然に促す結果をもたらす 15。

### **3.2 物理AIによる動的キュー管理とエージェンティック・レベニューマネジメント**

非航空系収入の増加は、ターミナル内のリソース最適化と直接的に連動している。セキュリティチェックポイントや出入国審査での長蛇の列は、旅客の滞在時間を無為に消費し、免税店での購買機会を直接的に奪う。Zensors社が提供するような物理AI（Physical AI）ソリューションによる分析では、既存のセキュリティ監視カメラ網からAI画像解析を通じてキュー（行列）の長さをリアルタイムでモニタリングし、ピーク時の旅客の待ち時間をわずか3分短縮するだけで、20%の旅客がコンセッション（商業エリア）で過ごす時間が増加し、年間で約1,500万ドルの非航空系収入の純増が見込めるという推計が提示されている 22。同時に、チェックインの自動モニタリングにより、マニュアルでの監視作業を排除することで、ターミナルのチェックポイントごとに年間約35,000ドルの運用コスト削減が実現される 22。

マルチエージェントシステムは、この物理的データをさらに高度な収益化戦略へと昇華させる。TCS（Tata Consultancy Services）の提案するエージェンティック・フレームワークでは、視覚的観察に依存していた到着プロファイルの予測をAIエージェントが代替し、チェックイン開始前から発生する群集を予測する 23。これに加えて、「Agentic AI」によるダイナミックプライシングとオファー管理が統合される 24。

1. **予測エージェント（Predictive Agent）**：フライトスケジュール、交通機関の運行状況、および物理AIによるターミナル内の人流データを統合分析し、今後30分間の各エリアの混雑度を予測する。  
2. **リソース最適化エージェント（Resource Optimization Agent）**：混雑予測に基づき、保安検査の追加レーンの開放や、特定エリアへの清掃・案内スタッフの再配置を指示する。  
3. **オファー生成エージェント（Offer Generation Agent）**：予測分析と強化学習（Reinforcement Learning）を用い、待ち時間が短縮されて心理的余裕が生まれた特定の旅客セグメントに対し、最適なタイミングで空港ラウンジのアップグレードや免税店のタイムセール通知をモバイル端末に送信する 24。

このように、運用情報と商用情報がマルチエージェントを通じて緊密に連携（Cross-source AI coordination）することで、カスタマーサクセス（CS）部門の目標が直接的に収益（Revenue）の成長へと結びつく構造が確立される 25。データ接続、データ品質のクレンジング、そして「AgentMind」と呼ばれる推論・記憶システムをオーケストレーションするAIエージェント・コントロールタワーの存在が、このリアルタイムな収益化を支えている 25。

### **3.3 インバウンド対応と多言語アバター・エージェントの統合**

カスタマージャーニーにおける人的な接点の最適化も、マルチエージェントの適用領域である。日本の羽田空港や南紀白浜空港では、急増するインバウンド観光客への対応とスタッフの業務負荷軽減を目的として、AIを活用した観光案内サービスの実証実験や本格導入が進められている。 羽田空港第3ターミナル直結の複合商業施設「羽田エアポートガーデン」では、AI接客システム「AIさくらさん」が導入され、多言語での施設案内を実現している 27。また、Spiral.AI社による生成AIを活用した非接触型・LINE連携の訪日観光客向け観光案内サービスも羽田空港で実証実験が行われており、多言語対応が課題となる日本の観光インフラにおいて、生成AIエージェントの役割が期待されている 28。同様に、南紀白浜空港では、NECやPictoriaと連携してAI VTuber「紡ネン」を活用し、LINE公式アカウントを通じて観光地の推薦やデジタルマップの提供、さらにはワーケーションのニーズに応じたワークスペースの案内を行い、来訪者の周遊性を高める取り組みを実施している 29。

これらのフロントエンドのアバターエージェントも、将来的なMAGSアーキテクチャの下では孤立したチャットボットではなく、背後のフライト情報エージェントや交通機関デジタルツインとA2Aで接続され、「帰りのフライトに間に合う範囲での最適な観光ルートの再計算」といった動的なタスクを自律的に提供する高度なコンシェルジュへと進化していく。

## **第4章 航空機地上支援（グランドハンドリング）およびタキシングの自律的最適化**

空港運用のキャパシティを物理的に制限する最大のボトルネックは、航空機の離着陸そのものではなく、到着から次の出発までに要する地上作業（ターンアラウンド）と、駐機場（エプロン）から滑走路までの地上移動（タキシング）にある。ここでも、サイロ化されていた従来の静的なスケジューリングから、分散型マルチエージェントによる動的で協調的なリソース配分へのパラダイムシフトが起きている。

### **4.1 グランドハンドリングリソースのマルチエージェント協調モデル**

航空機の地上支援（グランドハンドリング）プロセスには、清掃車、給水車、トーイングトラクター、ケータリング車両、手荷物ハンドラーなど、多数の異種車両およびスタッフが関与する。これらが狭いエプロンエリア内で複雑に交差するため、一つの遅延が玉突き的に全体のスケジュールを破綻させるリスクを常に内包している 30。

従来の数理最適化モデルが中央集権的に全スケジュールを一括計算しようとするのに対し、マルチエージェントアプローチでは、問題の複雑性を分散型の意思決定単位に分割する 31。ある研究において提案されたマルチエージェント・ベースのモデルでは、「意思決定エージェント（オーケストレーター）」、「航空機エージェント」、「清掃車エージェント」、「給水車エージェント」、「トラクターエージェント」という5種類の自律的エージェントが設定されている 30。 このシステムでは、到着便と出発便の予定時刻に基づき、オーケストレーターが全体のタスク順序を大まかに計画するが、各グラウンドハンドリングマネージャー（専用エージェント）は、自身のリソース状況に応じてタスクの引き受けや割り当てを決定する 30。もし特定の清掃車が前の作業の遅れにより到着できない場合、エージェント間でリアルタイムな情報交換（Communication flow）と再交渉が行われ、瞬時に代替リソースがアサインされる。このアプローチにより、特定の条件下で到着率（Aircraft arrival rate）が変動した場合でも、シミュレーション上において柔軟かつ効率的にすべての処理プロセスが完遂されることが証明されている 30。

コペンハーゲン・オプティマイゼーション社が提供する「Better Airport」のようなクラウドベースのソフトウェアプラットフォームは、これまでチェックイン、手荷物、保安検査、ゲート、出入国管理といった形で完全にサイロ化されていた空港運営部門を単一のツールに接続し、データの流れを可視化する 33。MAGSの枠組みはこれをさらに一歩進め、可視化されたデータに基づいて各部門のAIエージェントが直接的に調整（Coordination）を行う環境を提供する。

### **4.2 自律的航空機タキシングにおけるマルチエージェント・モーションプランニング（MAMP）**

空港地上移動（Surface Movement）の領域では、自動運転技術を応用した航空機の自律的なタキシング（Autonomous Aircraft Taxiing）に向けた研究が進んでいる。欧州のSESAR（単一欧州空域研究プログラム）の文脈で発表された論文では、タキシング操作のための分散・階層型マルチエージェントシステム（MAS）モデルが構築されている 34。

航空機はその巨大な質量、形状（翼幅）、および加速・減速にかかる時間（キネマティクス）という物理的制約を持つため、一般的なロボット向けの点（Point）ベースの経路探索アルゴリズムは適用できない 34。そこで、この領域ではマルチエージェント・パスファインディング（MAPF）よりも高度な「マルチエージェント・モーションプランニング（MAMP: Multi-Agent Motion Planning）」の概念が採用されている 34。 この階層型アーキテクチャでは以下のような役割分担が行われる。

1. \*\*空港運用エージェント（Airport Operations Agent：中央集権型）\*\*がフライトスケジュールと滑走路構成を定義し更新する。  
2. \*\*ルーティングエージェント（Routing Agent：中央集権型）\*\*が、SIPP（Safe Interval Path Planning）アルゴリズムを用いた低レベル探索（個別の航空機軌道計算）と、PBS（Priority-Based Search）アルゴリズムを用いた高レベルソルバー（エージェント間の競合調整）を組み合わせることで、対象となるすべての航空機エージェントに対して「競合のない（Conflict-free）」軌道を計画する 34。  
3. \*\*ガイダンスエージェント（Guidance Agents：分散型）\*\*が、計画されたルートを実行する各航空機エージェントに指示を与え、進行状況を監視する。

シミュレーションの結果、このMASモデルは15分ごとの再計画サイクルにおいて、30分間のプラニングウィンドウ内の予測タクシー時間に対する高い精度を実証している 34。タキシングの待機時間と燃料消費の削減は、チャンギ空港が掲げる「5年以内の炭素排出量15%削減」および「2050年までのネットゼロカーボン達成」といったサステナビリティ目標に対して、極めて強力な推進力となる 21。

### **4.3 ロボティクス・自動化プラットフォームとサイバーフィジカル統合**

物理的なロボットプラットフォームとAIエージェントの連携は、グランドハンドリングと旅客サービスの両面で飛躍的な効率化をもたらす。韓国の仁川国際空港では、労働力不足への対応と旅客需要の急増を背景に、強固なロボット基盤の自動化戦略を推進している 36。 同空港では、SoftonNetとLG CNSが共同開発した「AI X-ray」アルゴリズムが保安検査の検出精度を高める一方で 37、多様な次世代ロボット群がターミナル内を自律的にパトロール・サービス提供している。例えば、音声認識とAIを搭載した「Airstar Robot」が旅客のフライト番号に応じてチェックインカウンターまでエスコートし、「Air Porter Robot」が旅客の手荷物を追従して運び、「Air Ride Robot」が交通弱者（PRM）を搭乗口まで自動搬送する 37。さらに、「Air Dilly Robot」は搭乗ゲートで待機する旅客からのQRコード注文を受けて飲食物を自動配達する機能を備えている 38。

日本においても、国土交通省の「航空イノベーション推進協議会」において、空港制限区域内における自動走行（自動運転バスや無人トーイングトラクターなど）の実現に向けた検討委員会が継続的に開催されており、レベル4自動運転の実装へ向けた制度的・技術的な枠組み作りが進められている 39。

マルチエージェントシステムの観点からは、これらの自律移動ロボットや無人搬送車も、それぞれが「空間割り当てエージェント」や「ルート最適化エージェント」とA2Aで通信する個別の自律ノードとして扱われる 40。例えば、Roll-on/Roll-off（Ro-Ro）ターミナル管理のために提案されたMASアーキテクチャでは、オーケストレーター、空間割り当て、ルート最適化、フロー制御といった各機能がインダストリー4.0の原則に沿って統合されており、この概念はそのまま空港のランプエリア管理に応用可能である 40。あるロボットが障害物を検知した場合、その情報は即座に共有データベースを介してデジタルツイン上に反映され、他のすべてのロボット群が動的に経路を変更する。これにより、広大なターミナルやランプエリアにおいて、物理的衝突やデッドロックを完全に回避する「サイバーフィジカル・オペレーション」が実現する 40。

| 自動化・自律化の対象 | 主な関連テクノロジー / プロトコル | 実現される運用メリットとKPI |
| :---- | :---- | :---- |
| **グランドハンドリング** | マルチエージェント交渉モデル、A-CDM | 車両・人員の動的再割り当て、ターンアラウンド時間（TAT）の短縮、遅延波及の最小化 30 |
| **航空機タキシング** | MAMP (SIPP, PBSアルゴリズム) | 競合のない（Conflict-free）経路生成、燃料消費の大幅削減、タクシー時間の予測可能性向上 34 |
| **ターミナル内ロボティクス** | 5Gデジタルツイン、自律走行（SLAM） | 旅客の案内・手荷物搬送・飲食配達によるUX向上、PRM支援、保安検査（AI X-ray）の負荷軽減 36 |

## **第5章 航空貨物（カーゴ）オペレーションにおけるコンプライアンス自動化とRAGアーキテクチャ**

マルチエージェントシステムの活用シナリオは、旅客の目に見える範囲にとどまらない。膨大な紙ベースの文書処理と複雑な国際法規が交錯する航空貨物（カーゴ）の領域においても、AIエージェントは破壊的イノベーションを引き起こしている。

IATAが2025年に主導した「Data & Tech Proof of Concept（PoC）」プロジェクト（Industry LLM）は、単純なチャットボットを超え、貨物運用の複雑な規制コンプライアンスに対処するための生成AIの可能性を証明した 41。このPoCのターゲットユースケースに選ばれたのは「生鮮貨物（Perishables）の受託プロセス」である。生鮮貨物は賞味期限が限られているため、文書の不備による受託遅延は製品の腐敗（スポイレッジ）や廃棄に直結する。しかし、従来の手作業によるAir Waybill（AWB：航空運送状）や各種証明書の確認と、複雑なIATA生鮮貨物規則（PCR）との照合には、一件あたり最大20分を要し、ヒューマンエラーが頻発していた 41。

この課題に対し、IATAはOpenAIのGPT-4oモデルを基盤とし、検索拡張生成（Retrieval-Augmented Generation: RAG）のパラダイムを用いたAI駆動型のドキュメント抽出・検証システムを構築した 41。 運用フローは以下のように設計された。

1. スタッフが現場で、モバイルベースのUI（Dreamix社開発）またはWhatsAppチャネル（SITA社開発）を用いて、AWBや付属の証明書の画像をスキャン・撮影する 41。  
2. カタール航空のIT部門が構築した統合レイヤーを介して、データは標準API経由でバックエンドモジュール群に送信される。  
3. Infosys、Microsoft、SITA、Snowflakeといった戦略的パートナーによって開発されたモジュールが、RAGを用いて文書から構造化データを抽出し、IATAのPCRや各航空会社固有のローカルルール（バリエーション）を動的に検索・参照しながら適合性を推論・検証する 41。

約30のテストケースを用いた検証の結果、このシステムは、画質の悪い書類やAWBと添付ファイル間の内容の不一致といった複雑なエッジケースにおいても、**90%という極めて高い精度**を達成した 41。重要なのは、確率論的モデルであるLLMに対して「絶対的な完璧さ」を求めるのではなく、人間の処理能力と精度を実質的に上回る「効率的なエージェント機能」を実装した点である。これにより、文書エラーに起因する生鮮品の腐敗を防ぎ、貨物スペースの利用効率を最適化し、ひいてはカーゴ産業全体の環境負荷（廃棄ロス）を低減させるという明確なサステナビリティの利益が生み出された 41。

さらに、IATAはB2BおよびB2Cの双方において、セキュリティとパーソナライゼーションの重要なイネーブラーとなる「デジタルアイデンティティ」の確立（Project 777およびProject 321）に向けた取り組みも並行して進めており、これらのデータ・アーキテクチャがAIエージェントの自律的検証プロセスの基盤を補強している 41。ここでも、時代遅れのデータ流通モデルを排し、LLMモデルの進化に合わせて柔軟にバックエンドの推論エンジンを入れ替えることができる「APIファースト（将来的なエージェント・プロトコル・ファースト）」の設計思想が強く推奨されている 41。

## **第6章 法規制、サイバーセキュリティ、および安全基準の国際的枠組み**

高度な推論能力を持つAIエージェントが、フライトオペレーション、トラフィック制御、出入国管理などのミッションクリティカルな領域に介入する際、克服すべき最大のハードルは技術的限界ではなく、法規制への準拠と安全保障（Safety & Security）の確立である。エージェントが自律性（Autonomy）を獲得すればするほど、ブラックボックス化された意思決定に対する監査可能性（Auditability）と、人間による究極的なコントロールの担保が不可避の要求となる 42。

### **6.1 EU AI法（EU AI Act）とEASAが要求する「人間の監視」と堅牢性**

欧州連合（EU）が施行した「EU AI法（EU AI Act）」は、航空産業におけるAI実装の事実上のグローバルスタンダードとなりつつある。この法律では、民間航空のセキュリティ、車両セキュリティ、無線機器などの分野において、製品の安全コンポーネントとして機能するAIシステム（Annex I記載）、および特定のリスク管理に関わるAIシステム（Annex III記載）を「高リスクAIシステム（High-risk AI systems）」として厳格に定義している 43。

これに呼応する形で、欧州航空安全機関（EASA）はAIロードマップを策定し、フライトオペレーション（乱気流や着氷条件の予測、操縦士の意思決定支援）、メンテナンス（デジタル化されたデータに基づく予知保全と部品寿命予測）、そして環境（炭素排出削減のための軌道最適化）の各ドメインにおいて、機械学習（ML）の恩恵を安全に享受するための規制アプローチを示している 44。EASAのレポートは、MLの運用パフォーマンスを評価するための標準的な方法が欠如していること、アルゴリズムの複雑性、そして適応的に変化するソフトウェアが「予測不能な挙動（Unpredictable behavior）」を引き起こす危険性を深く懸念している 45。

EU AI法の下では、高リスクAIシステムを運用するデプロイヤー（Deployer：空港運営会社や航空会社など）は、システムを指示書に従って運用する義務に加え、以下の厳格な要件を満たさなければならない 46。

1. **人間の監視（Human Oversight）**：AIの判断を監視し、必要に応じて介入・無効化できる体制の構築。この任務を割り当てられた人間は、必要な能力、訓練、および権限を有していなければならない。  
2. **インシデント報告とログ**：潜在的なリスクを監視し、問題や深刻なインシデントが発生した場合は直ちにプロバイダーや関係当局に報告する義務。労働者やAIの決定の影響を受ける人々への情報提供も含まれる。  
3. **堅牢性と冗長性（Robustness and Redundancy）**：市場投入後も継続的に学習を行うAIシステムは、偏見や誤動作を排除するよう開発され、フェイルセーフ計画やバックアップを含む技術的冗長性によって堅牢性を担保しなければならない 47。

### **6.2 ICAOによる「信頼されるAI」とハルシネーション・リスクの管理**

国際民間航空機関（ICAO）もまた、航空交通管理や空港運用といった安全制約の厳しい領域でのAI利用において、「信頼されるAI（Trustworthy AI）」のための調和された規制フレームワークの構築を主導している 48。ICAO総会において、イノベーションに関する方針とAIタスクフォースの設立が承認され、標準化された認証フレームワークの策定が進められている 50。

ICAOの議論において特に重要視されているのが、生成AI特有のリスクである「ハルシネーション（もっともらしい虚偽情報の生成）」の管理と、説明可能性（Explainability）の確保である 48。マルチエージェントシステムが複雑な予測（例えば、急な天候悪化に伴う大規模なゲート再割り当てや着陸順序の変更）を行った際、その推論ロジックが追跡可能（Traceable）でなければならない。さらに、最終的な安全責任と権限は、AIではなく認定された人間の担当者（ディスパッチャーや管制官）に留保されるという明確な「説明責任（Accountability）」の構造が不可欠であると結論付けられている 51。 また、サイバーセキュリティ基準への準拠も極めて重要視されている。悪意のある無人航空機システム（UAS）による物理的脅威や、GNSS（全地球航法衛星システム）の電波干渉といった新たなリスクに対抗するため、ICAOは各国のサイバーセキュリティリスク管理フレームワークへのAI監視システムの組み込みを要求している 50。AIモデルに供給されるデータの質が悪意ある攻撃（データポイズニング等）によって汚染された場合、システム全体の信頼性が崩壊するため、データの出所管理と保護は最優先課題となる 52。

### **6.3 段階的自律性（Progressive Autonomy）と日本のプライバシーガイドライン**

これらの厳格な安全・セキュリティ要件に対する実践的なアーキテクチャ上の解決策として、DTC（Digital Twin Consortium）が提唱する「段階的自律性（Progressive Autonomy）」というアプローチが注目されている 42。これは、エージェントの自律レベルを、人間の役割、承認プロセス、および安全臨界度（Safety Criticality）に厳密にマッピングする手法である。学習によって得られたシステムの改善や新たな推論ロジックは、安全性が数学的・論理的に保証された管理プロセス（デジタルツイン上での徹底した検証など）を経た場合にのみ、物理環境への展開が許可される 42。マルチエージェントのオーケストレーションにおいては、特定の能力を持つエージェント間の階層構造（Safety Hierarchies）を明確化し、安全保障の責任を担う最上位の監視エージェントが常にシステムのフェイルセーフを担保する。

また、旅客の予約データや生体情報（バイオメトリクス）を扱うエージェント運用において、プライバシー法制への対応も欠かせない。日本の法務省が進める顔認証技術を用いた円滑かつ厳格な出入国審査や 53、個人情報保護委員会（PPC）が発行する生成AIサービスの利用に関するガイドライン（プロンプト入力時の機密情報の取り扱い等に関する注意喚起）は、AIエージェントの開発・運用において設計段階からプライバシー保護のメカニズムを組み込む「Privacy by Design」の原則を要求している 54。空港内でのサイレント・コンシェルジュ・サービスを実現するためには、エージェント間でのデータ共有（A2A通信）がユーザーの明示的な同意に基づいて行われること、また不要なデータ保持を避けるためのセキュアなガバナンスハブ機能（Guardrails）が不可欠である 25。

## **第7章 結語：未来のスマート空港に向けた戦略的ロードマップ**

2026年以降の空港ビジネスにおいて、AIエージェントチーム（マルチエージェントシステム：MAS）の本格的な導入は、単なる業務効率化やコスト削減の手段という枠組みを超え、空港エコシステム全体の収益性とレジリエンス（回復力）を根本から変革する「経営戦略のコア」である。本報告書での多角的な分析に基づき、次世代スマート空港の競争優位性を確立するための戦略的ロードマップを以下に総括する。

第一に、**「APIファースト」から「エージェント・プロトコル・ファースト」へのシステムアーキテクチャの抜本的移行**である。従来の静的でハードコードされたシステム統合アプローチを脱却し、GoogleのA2Aプロトコルに代表される自律分散型の通信基盤を採用すべきである。これにより、旅客フロー管理エージェント、ロボティクス制御エージェント、グランドハンドリング最適化エージェントといった専門機能が動的かつ意味論的に連動し、天候不良や機材トラブルといった予期せぬインシデントに対しても、自律的な交渉と再スケジュールによってシステム全体が自己組織化（Self-organizing）する極めて高いレジリエンスを獲得できる。

第二に、**デジタルツインと生成AIの融合（MAGS）による「予測的・予防的オペレーション」の確立**である。空港内の監視カメラ網、IoTセンサー、航空機運行データなど、あらゆる物理的コンテキストをエッジコンピューティング環境下で統合し、デジタルツイン上でAIエージェントに「What-if」の因果グラフシミュレーションを継続的に実行させる。これにより、事象が発生してから対応するリアクティブ（事後対応型）な危機管理から、ボトルネックを事前に特定し、リソースの再配分を完了させておくプロアクティブ（予防型）な運用体制へと完全に移行することが可能となる。

第三に、**「旅客の認知的負荷の極小化」を通じた非航空系収入（Non-aeronautical Revenue）の戦略的創出**である。サイレント・コンシェルジュに象徴されるパーソナライズされたAIエージェントは、旅行プロセスにおけるフリクション（摩擦）を徹底的に排除し、旅客の心理的・時間的な「余白」を生み出す。この余白に対して、Agentic AIがリアルタイムにダイナミックプライシング・オファーを提示することで、空港での滞在時間は単なる通過プロセスから高付加価値な消費体験へと昇華し、収益構造の劇的な転換をもたらす。

第四に、**国際的な法規制（EU AI ActやICAO基準）に準拠した「段階的自律性（Progressive Autonomy）」に基づくガバナンスの構築**である。AIエージェントにミッションクリティカルな意思決定権限を委譲するプロセスにおいては、「人間の監視（Human Oversight）」、説明責任、および堅牢性の証明が不可欠である。プライバシー保護（PPCガイドラインへの準拠）を含め、システムの安全臨界度に応じた明確な安全境界（Safety Boundaries）を設定し、監査可能な透明性を維持しながらエージェントの運用範囲を段階的に拡大していく強固なガバナンス体制が求められる。

現代の航空インフラは、ソフトウェア、物理的ロボティクス、そして人間が高度なプロトコルを通じてシームレスに交響する新たな次元へと突入している。組織内部のサイロを破壊し、マルチエージェントシステムの潜在能力を包括的なデータ基盤の上でオーケストレーションできる空港運営者のみが、環境制約と爆発的な需要増のトレードオフを乗り越え、来るべき未来の航空産業において真のリーダーシップを確立することになる。

#### **引用文献**

1. International Air Connectivity in 2025 \- Global Trends and Developments \- IATA, 5月 2, 2026にアクセス、 [https://www.iata.org/en/publications/economics/reports/international-air-connectivity-in-2025/](https://www.iata.org/en/publications/economics/reports/international-air-connectivity-in-2025/)  
2. Data Center \- ACI World, 5月 2, 2026にアクセス、 [https://aci.aero/resources/data-center/](https://aci.aero/resources/data-center/)  
3. ARTIFICIAL INTELLIGENCE \- ACI Asia-Pacific, 5月 2, 2026にアクセス、 [https://www.aci-asiapac.aero/f/library/8950/ACI\_YEA2025\_Research\_Paper\_Patrick\_Su\_finalized.pdf](https://www.aci-asiapac.aero/f/library/8950/ACI_YEA2025_Research_Paper_Patrick_Su_finalized.pdf)  
4. The future of airports: Inside Singapore Changi's innovations | McKinsey, 5月 2, 2026にアクセス、 [https://www.mckinsey.com.br/industries/infrastructure/our-insights/the-future-takes-flight-at-singapore-changi-airport](https://www.mckinsey.com.br/industries/infrastructure/our-insights/the-future-takes-flight-at-singapore-changi-airport)  
5. Multi-Agent Systems: Orchestrating AI Agents with A2A Protocol | by Yusuf Baykaloğlu, 5月 2, 2026にアクセス、 [https://medium.com/@yusufbaykaloglu/multi-agent-systems-orchestrating-ai-agents-with-a2a-protocol-19a27077aed8](https://medium.com/@yusufbaykaloglu/multi-agent-systems-orchestrating-ai-agents-with-a2a-protocol-19a27077aed8)  
6. Top 5 Open Protocols for Building Multi-Agent AI Systems 2026 \- OneReach.ai, 5月 2, 2026にアクセス、 [https://onereach.ai/blog/power-of-multi-agent-ai-open-protocols/](https://onereach.ai/blog/power-of-multi-agent-ai-open-protocols/)  
7. A2A \- Understanding the Basics and Building Multi-Agent Flight Management System, 5月 2, 2026にアクセス、 [https://dev.to/cloudx/a2a-understanding-the-basics-and-building-multi-agent-flight-management-system-39c7](https://dev.to/cloudx/a2a-understanding-the-basics-and-building-multi-agent-flight-management-system-39c7)  
8. Building Enterprise Intelligence: A Guide to AI Agent Protocols for Multi-Agent Systems, 5月 2, 2026にアクセス、 [https://blog.workday.com/en-us/building-enterprise-intelligence-a-guide-to-ai-agent-protocols-for-multi-agent-systems.html](https://blog.workday.com/en-us/building-enterprise-intelligence-a-guide-to-ai-agent-protocols-for-multi-agent-systems.html)  
9. Digital Twin Consortium Members Develop and Deploy Multi-Agent Gen AI Systems, 5月 2, 2026にアクセス、 [https://www.digitaltwinconsortium.org/press-room/07-23-24/](https://www.digitaltwinconsortium.org/press-room/07-23-24/)  
10. Mathematical Framework for Airport as Cognitive Digital Twin of Aviation Ecosystem \- MDPI, 5月 2, 2026にアクセス、 [https://www.mdpi.com/2227-7390/14/3/558](https://www.mdpi.com/2227-7390/14/3/558)  
11. Agent-based modeling to support collaborative decision making in predictable airport ground operations \- sesar ju, 5月 2, 2026にアクセス、 [https://www.sesarju.eu/sites/default/files/documents/sid/2022/paper\_101.pdf](https://www.sesarju.eu/sites/default/files/documents/sid/2022/paper_101.pdf)  
12. デジタルツイン | NTTデータ, 5月 2, 2026にアクセス、 [https://www.nttdata.com/jp/ja/services/digital-twin/](https://www.nttdata.com/jp/ja/services/digital-twin/)  
13. 企業・法人事例｜株式会社NTTデータ数理システム, 5月 2, 2026にアクセス、 [https://www.msi.co.jp/solution/s4/case\_company.html](https://www.msi.co.jp/solution/s4/case_company.html)  
14. The Role and Applications of Airport Digital Twin in Cyberattack Protection during the Generative AI Era \- arXiv, 5月 2, 2026にアクセス、 [https://arxiv.org/html/2408.05248v1](https://arxiv.org/html/2408.05248v1)  
15. South Korea Advances Airport Operations with Robotics and AI, Following Global Leaders, 5月 2, 2026にアクセス、 [https://www.eplaneai.com/es/news/south-korea-advances-airport-operations-with-robotics-and-ai-following-global-leaders](https://www.eplaneai.com/es/news/south-korea-advances-airport-operations-with-robotics-and-ai-following-global-leaders)  
16. NARTP Strategic Innovation Center and Digital Twin Consortium Collaborate to Test and Develop Multi-Agent AI Digital Twins Across Aviation, 5月 2, 2026にアクセス、 [https://www.digitaltwinconsortium.org/press-room/nartp-strategic-innovation-center-and-digital-twin-consortium-collaborate-to-test-and-develop-multi-agent-ai-digital-twins-across-aviation/](https://www.digitaltwinconsortium.org/press-room/nartp-strategic-innovation-center-and-digital-twin-consortium-collaborate-to-test-and-develop-multi-agent-ai-digital-twins-across-aviation/)  
17. Airport Technology Solutions \- Arche Global, 5月 2, 2026にアクセス、 [https://arche.global/smart-cities](https://arche.global/smart-cities)  
18. Smarter and more personalised travel experiences: Changi Airport Group's AI-powered vision for the future \- the Adobe Blog, 5月 2, 2026にアクセス、 [https://blog.adobe.com/en/publish/2025/05/15/smarter-and-more-personalised-travel-experiences-changi-airport-groups-ai-powered-vision-for-the-future](https://blog.adobe.com/en/publish/2025/05/15/smarter-and-more-personalised-travel-experiences-changi-airport-groups-ai-powered-vision-for-the-future)  
19. SIN, HKG, ICN, NRT, GMR Group, AKL & more among FTE Airport Digital Transformation Power List Asia-Pacific 2025, 5月 2, 2026にアクセス、 [https://www.futuretravelexperience.com/2025/10/sin-hkg-icn-nrt-gmr-group-akl-more-among-fte-airport-digital-transformation-power-list-asia-pacific-2025/](https://www.futuretravelexperience.com/2025/10/sin-hkg-icn-nrt-gmr-group-akl-more-among-fte-airport-digital-transformation-power-list-asia-pacific-2025/)  
20. b e y o n d transforming \- boundaries tomorrow \- Changi Airport, 5月 2, 2026にアクセス、 [https://www.changiairport.com/content/dam/changiairport/common/pdf/publications/2024-25/cag-ar-2024-25-beyond-boundaries-transforming-tomorrow-oct.pdf](https://www.changiairport.com/content/dam/changiairport/common/pdf/publications/2024-25/cag-ar-2024-25-beyond-boundaries-transforming-tomorrow-oct.pdf)  
21. Changi Airport — AI & Digital Transformation Case Study, 5月 2, 2026にアクセス、 [https://www.aitransformationreadiness.org/post/changi-airport-digital-transformation](https://www.aitransformationreadiness.org/post/changi-airport-digital-transformation)  
22. Harry Reid International Airport (LAS) Elevates Passenger Experience with Physical AI, 5月 2, 2026にアクセス、 [https://www.zensors.com/post/zensors-physical-ai-for-las-vegas-airports](https://www.zensors.com/post/zensors-physical-ai-for-las-vegas-airports)  
23. Optimizing Passenger Flow in Airports for a Better Travel Experience, 5月 2, 2026にアクセス、 [https://www.tcs.com/insights/blogs/optimize-passenger-flow-airports-better-experience](https://www.tcs.com/insights/blogs/optimize-passenger-flow-airports-better-experience)  
24. Agentic AI: The Next Leap in Airline Offer Creation and Revenue Management \- PROS, 5月 2, 2026にアクセス、 [https://pros.com/learn/blog/agentic-ai-next-leap-airline-offer-creation-revenue-management/](https://pros.com/learn/blog/agentic-ai-next-leap-airline-offer-creation-revenue-management/)  
25. AI Monetization Strategy: Turning Agentic AI into Revenue \- Covasant, 5月 2, 2026にアクセス、 [https://www.covasant.com/blogs/ai-monetization-strategy-turning-agentic-ai-into-revenue](https://www.covasant.com/blogs/ai-monetization-strategy-turning-agentic-ai-into-revenue)  
26. How AI Agents and Unified Platforms Are Transforming Revenue Growth \- Gainsight, 5月 2, 2026にアクセス、 [https://www.gainsight.com/blog/how-ai-agents-and-unified-platforms-are-transforming-revenue-growth/](https://www.gainsight.com/blog/how-ai-agents-and-unified-platforms-are-transforming-revenue-growth/)  
27. 羽田エアポートガーデン | AIさくらさん導入事例 | AIチャットボット・アバター接客でDX推進, 5月 2, 2026にアクセス、 [https://www.tifana.ai/works/20230919](https://www.tifana.ai/works/20230919)  
28. 羽田空港でAIを活用した訪日観光客向け観光案内サービスの実証実験を開始。スタッフの業務負荷軽減に期待 \- AIsmiley, 5月 2, 2026にアクセス、 [https://aismiley.co.jp/ai\_news/spiralai-yamatoholdings-tourist-haneda-airport/](https://aismiley.co.jp/ai_news/spiralai-yamatoholdings-tourist-haneda-airport/)  
29. Pictoria、南紀白浜エアポート、NECはAIVTuber「紡ネン」を活用し、南紀白浜の魅力をアピール！, 5月 2, 2026にアクセス、 [https://prtimes.jp/main/html/rd/p/000000533.000078149.html](https://prtimes.jp/main/html/rd/p/000000533.000078149.html)  
30. (PDF) A Multi Agent Based Model for Airport Service Planning \- ResearchGate, 5月 2, 2026にアクセス、 [https://www.researchgate.net/publication/50425812\_A\_Multi\_Agent\_Based\_Model\_for\_Airport\_Service\_Planning](https://www.researchgate.net/publication/50425812_A_Multi_Agent_Based_Model_for_Airport_Service_Planning)  
31. Production Scheduling Based on a Multi-Agent System and Digital Twin: A Bicycle Industry Case \- MDPI, 5月 2, 2026にアクセス、 [https://www.mdpi.com/2078-2489/15/6/337](https://www.mdpi.com/2078-2489/15/6/337)  
32. A Multi-Agent Planning Model for Airport Ground Handling Management \- GitHub Pages, 5月 2, 2026にアクセス、 [https://patrickkabongo.github.io/assets/file.pdf](https://patrickkabongo.github.io/assets/file.pdf)  
33. Copenhagen Optimization \- Airport Operations Reimagined, 5月 2, 2026にアクセス、 [https://copenhagenoptimization.com/](https://copenhagenoptimization.com/)  
34. Multi-Agent Planning for Autonomous Airport Surface Movement Operations \- sesar ju, 5月 2, 2026にアクセス、 [https://www.sesarju.eu/sites/default/files/documents/sid/2023/Papers/SIDs\_2023\_paper\_45%20final.pdf](https://www.sesarju.eu/sites/default/files/documents/sid/2023/Papers/SIDs_2023_paper_45%20final.pdf)  
35. Multi-Agent Planning for Autonomous Airport Surface Movement Operations \- TU Delft Research Portal, 5月 2, 2026にアクセス、 [https://research.tudelft.nl/en/publications/multi-agent-planning-for-autonomous-airport-surface-movement-oper](https://research.tudelft.nl/en/publications/multi-agent-planning-for-autonomous-airport-surface-movement-oper)  
36. Where robots meet passengers: ICN's AI-powered airport of the future \- PTE World 2026, 5月 2, 2026にアクセス、 [https://www.pte-world.com/ptx26c-passenger-terminal-conference/where-robots-meet-passengers-icns-ai-powered-airport-of-the-future](https://www.pte-world.com/ptx26c-passenger-terminal-conference/where-robots-meet-passengers-icns-ai-powered-airport-of-the-future)  
37. Incheon Airport presses ahead with AI, biometrics and big data plans, 5月 2, 2026にアクセス、 [https://www.futuretravelexperience.com/2020/05/incheon-airport-presses-ahead-ai-biometrics-big-data/](https://www.futuretravelexperience.com/2020/05/incheon-airport-presses-ahead-ai-biometrics-big-data/)  
38. Innovation in Incheon: From robot guides to robot food delivery | Delta News Hub, 5月 2, 2026にアクセス、 [https://news.delta.com/innovation-incheon-robot-guides-robot-food-delivery](https://news.delta.com/innovation-incheon-robot-guides-robot-food-delivery)  
39. 航空：第16回空港制限区域内における自動走行の実現に向けた検討 ..., 5月 2, 2026にアクセス、 [https://www.mlit.go.jp/koku/koku\_tk9\_000089.html](https://www.mlit.go.jp/koku/koku_tk9_000089.html)  
40. Multi-Agent System for Smart Roll-on/Roll-off Terminal Management: Orchestration and Communication Strategies for AI-Driven Optimization \- MDPI, 5月 2, 2026にアクセス、 [https://www.mdpi.com/2076-3417/15/11/6079](https://www.mdpi.com/2076-3417/15/11/6079)  
41. Exploring Artificial Intelligence and Digital Identity Use Cases ... \- IATA, 5月 2, 2026にアクセス、 [https://www.iata.org/contentassets/a46387f9bc6b42368c0a72664f6f930f/data-tech-poc-2025.pdf](https://www.iata.org/contentassets/a46387f9bc6b42368c0a72664f6f930f/data-tech-poc-2025.pdf)  
42. Digital Twin Consortium Publishes Industrial AI Agent Manifesto, Led by XMPro, 5月 2, 2026にアクセス、 [https://xmpro.com/digital-twin-consortium-publishes-industrial-ai-agent-manifesto-led-by-xmpro/](https://xmpro.com/digital-twin-consortium-publishes-industrial-ai-agent-manifesto-led-by-xmpro/)  
43. European Union Artificial Intelligence Act: a guide, 5月 2, 2026にアクセス、 [https://www.twobirds.com/-/media/new-website-content/pdfs/capabilities/artificial-intelligence/european-union-artificial-intelligence-act-guide.pdf](https://www.twobirds.com/-/media/new-website-content/pdfs/capabilities/artificial-intelligence/european-union-artificial-intelligence-act-guide.pdf)  
44. Artificial Intelligence and Aviation \- EASA \- European Union, 5月 2, 2026にアクセス、 [https://www.easa.europa.eu/en/light/topics/artificial-intelligence-and-aviation-0](https://www.easa.europa.eu/en/light/topics/artificial-intelligence-and-aviation-0)  
45. AI in aviation: regulating autonomous flights \- LoupedIn, 5月 2, 2026にアクセス、 [https://loupedin.blog/2020/05/ai-in-aviation-regulating-autonomous-flights/](https://loupedin.blog/2020/05/ai-in-aviation-regulating-autonomous-flights/)  
46. The AI Act and its impact on the aviation sector \- EASA, 5月 2, 2026にアクセス、 [https://www.easa.europa.eu/sites/default/files/dfu/2024-07-02\_easa\_ai\_days\_presentations\_day1.pdf](https://www.easa.europa.eu/sites/default/files/dfu/2024-07-02_easa_ai_days_presentations_day1.pdf)  
47. Article 15: Accuracy, Robustness and Cybersecurity | EU Artificial Intelligence Act, 5月 2, 2026にアクセス、 [https://artificialintelligenceact.eu/article/15/](https://artificialintelligenceact.eu/article/15/)  
48. Artificial intelligence (ai) contribution to aviation \- ICAO, 5月 2, 2026にアクセス、 [https://www.icao.int/sites/default/files/Meetings/a42/Documents/WP/wp\_489\_en.pdf](https://www.icao.int/sites/default/files/Meetings/a42/Documents/WP/wp_489_en.pdf)  
49. A Cross-Regional Review of AI Safety Regulations in the Commercial Aviation Industry, 5月 2, 2026にアクセス、 [https://www.mdpi.com/2076-3387/16/1/53](https://www.mdpi.com/2076-3387/16/1/53)  
50. ICAO enhances global aviation safety and security framework, 5月 2, 2026にアクセス、 [https://www.icao.int/news/icao-enhances-global-aviation-safety-and-security-framework](https://www.icao.int/news/icao-enhances-global-aviation-safety-and-security-framework)  
51. Global standardization of operational control in the era of ai and automated flight planning \- ICAO, 5月 2, 2026にアクセス、 [https://www.icao.int/sites/default/files/Meetings/a42/Documents/WP/wp\_621\_en.pdf](https://www.icao.int/sites/default/files/Meetings/a42/Documents/WP/wp_621_en.pdf)  
52. Current practices and artificial intelligence enhancements \- ICAO, 5月 2, 2026にアクセス、 [https://www.icao.int/sites/default/files/Meetings/a42/Documents/WP/wp\_401\_en.pdf](https://www.icao.int/sites/default/files/Meetings/a42/Documents/WP/wp_401_en.pdf)  
53. 出入国在留管理庁2025-2026（日本語版）（PDF \- 法務省, 5月 2, 2026にアクセス、 [https://www.moj.go.jp/isa/content/001425123.pdf](https://www.moj.go.jp/isa/content/001425123.pdf)  
54. 生成AIサービスの利用に関する注意喚起等について \- 個人情報保護委員会, 5月 2, 2026にアクセス、 [https://www.ppc.go.jp/news/careful\_information/230602\_AI\_utilize\_alert](https://www.ppc.go.jp/news/careful_information/230602_AI_utilize_alert)