import type {
  CharacterTemplate,
  Classroom,
  ClassicWork,
  CutTemplate,
  ProductionRole,
  TeamSize,
  WorkId,
  WorkVariant,
} from "@/lib/types";

export const PRODUCTION_ROLES: ProductionRole[] = [
  "연출",
  "각색/시나리오",
  "촬영관리",
  "장면관리/편집관리",
  "소품/무대관리",
  "기록/진행",
];

type RoleSeed = [name: string, traits: string[], action: string, line: string];
type BeatSeed = [title: string, summary: string, emotion: string[], line: string, props: string[], atmosphere: string];

function characters(workId: WorkId, rows: RoleSeed[]): CharacterTemplate[] {
  return rows.map(([name, personality, actionCue, lineCue], index) => ({
    id: `${workId}-role-${index + 1}`,
    name,
    personality,
    actionCue,
    lineCue,
  }));
}

function cuts(size: TeamSize, beats: BeatSeed[], cast: CharacterTemplate[]): CutTemplate[] {
  const roleNames = cast.map((role) => role.name);
  const picks: Record<TeamSize, number[]> = { 4: [0, 1, 3, 5], 5: [0, 1, 2, 4, 5], 6: [0, 1, 2, 3, 4, 5] };
  return picks[size].map((beatIndex, index) => {
    const [title, summary, emotion, linePrompt, props, atmosphere] = beats[beatIndex];
    const activeCharacters = roleNames.filter((_, roleIndex) =>
      index === roleIndex % size || index === (roleIndex + 1) % size || index === size - 1,
    );
    return {
      order: index + 1,
      title,
      summary,
      activeCharacters: activeCharacters.length ? activeCharacters : [roleNames[index]],
      emotion,
      linePrompt,
      props,
      atmosphere,
      modelDialogue: activeCharacters.slice(0, 3).map((speakerName) => {
        const character = cast.find((role) => role.name === speakerName)!;
        return {
          speakerCharacterId: character.id,
          speakerName: character.name,
          text: character.lineCue,
          direction: character.actionCue,
        };
      }),
    };
  });
}

function variant(workId: WorkId, size: TeamSize, roleRows: RoleSeed[], beats: BeatSeed[]): WorkVariant {
  const cast = characters(workId, roleRows.slice(0, size)).map((character, index) => ({
    ...character,
    id: `${workId}-${size}-role-${index + 1}`,
  }));
  return { teamSize: size, characters: cast, cuts: cuts(size, beats, cast) };
}

function work(
  base: Omit<ClassicWork, "variants">,
  roles: Record<TeamSize, RoleSeed[]>,
  beats: BeatSeed[],
): ClassicWork {
  return {
    ...base,
    variants: {
      4: variant(base.id, 4, roles[4], beats),
      5: variant(base.id, 5, roles[5], beats),
      6: variant(base.id, 6, roles[6], beats),
    },
  };
}

const heungbuRoles: Record<TeamSize, RoleSeed[]> = {
  4: [
    ["흥부", ["착함", "절박함"], "빈 쌀독을 보여 주며 도움을 청한다.", "형님, 아이들이 굶고 있습니다."],
    ["놀부", ["욕심", "완고함"], "쌀자루를 감싸 쥐고 흥부를 밀어낸다.", "내 재산은 한 톨도 줄 수 없다!"],
    ["흥부 아내", ["현실적", "용기"], "흥부 곁에 서서 가족의 사정을 또렷이 말한다.", "우리가 바라는 건 오늘 먹을 한 끼뿐이에요."],
    ["놀부 아내", ["냉정", "동요"], "놀부를 부추기다가 이웃의 시선을 의식한다.", "어서 내보내요… 하지만 이건 너무 심한가?"],
  ],
  5: [] as unknown as RoleSeed[],
  6: [] as unknown as RoleSeed[],
};
heungbuRoles[5] = [...heungbuRoles[4], ["마을 어른", ["정의", "단호함"], "형제의 도리를 따져 묻고 갈등을 멈춰 세운다.", "재물이 형제의 정까지 삼켜서야 되겠느냐?"]];
heungbuRoles[6] = [...heungbuRoles[5], ["이웃 장쇠", ["솔직함", "행동력"], "굶는 아이들에게 자기 곡식을 내어주며 놀부를 부끄럽게 한다.", "적어도 나는 이 한 됫박을 나누겠소!"]];

const chunhyangRoles: Record<TeamSize, RoleSeed[]> = {
  4: [
    ["춘향", ["굳은 의지", "당당함"], "옥중에서도 허리를 펴고 강요를 거절한다.", "마음과 절개는 힘으로 꺾을 수 없습니다."],
    ["변학도", ["오만", "권력욕"], "명령을 내리며 춘향을 굴복시키려 한다.", "내 뜻을 거스르고도 무사할 줄 아느냐?"],
    ["이몽룡/암행어사", ["침착", "정의"], "초라한 행색을 벗고 마패를 높이 든다.", "암행어사 출두요!"],
    ["향단", ["충직", "재치"], "춘향을 지키고 관아의 부당함을 증언한다.", "사또의 명은 법이 아니라 횡포입니다."],
  ],
  5: [] as unknown as RoleSeed[],
  6: [] as unknown as RoleSeed[],
};
chunhyangRoles[5] = [...chunhyangRoles[4], ["방자", ["눈치", "기민함"], "암행어사의 신호를 전달하고 문을 연다.", "밖에 수상한 나졸들이 관아를 에워쌌습니다!"]];
chunhyangRoles[6] = [...chunhyangRoles[5], ["형방", ["비겁함", "갈등"], "거짓 장부를 숨기다 결국 변학도의 죄를 고한다.", "사또가 백성의 곡식을 빼앗았습니다."]];

const hongRoles: Record<TeamSize, RoleSeed[]> = {
  4: [
    ["홍길동", ["총명", "상처", "결단"], "호부호형하지 못한 설움을 말하고 집을 떠날 결심을 한다.", "아버지를 아버지라 부르지 못하는 삶을 바꾸겠습니다."],
    ["홍 판서", ["권위", "내적 갈등"], "길동을 아끼면서도 신분 질서를 내세운다.", "재주는 뛰어나나 법도가 너를 가로막는구나."],
    ["초란", ["질투", "불안"], "길동이 집안을 위협한다며 몰아세운다.", "저 아이를 그대로 두면 모두가 위험해집니다."],
    ["곡산댁", ["모성", "걱정"], "길동의 손을 붙잡고 위험을 경고한다.", "분함을 품되 네 마음까지 잃지는 말거라."],
  ],
  5: [] as unknown as RoleSeed[],
  6: [] as unknown as RoleSeed[],
};
hongRoles[5] = [...hongRoles[4], ["홍인형", ["양심", "우애"], "동생 길동의 능력을 인정하며 아버지에게 맞선다.", "길동도 분명 이 집안의 자식입니다."]];
hongRoles[6] = [...hongRoles[5], ["하인 돌쇠", ["충직", "경계"], "자객의 움직임을 알아채 길동에게 알린다.", "도련님, 오늘 밤 누군가 방을 노립니다!"]];

const simRoles: Record<TeamSize, RoleSeed[]> = {
  4: [
    ["심청", ["효심", "그리움"], "왕후의 자리에서 아버지의 목소리를 알아듣고 달려간다.", "아버지, 정말 제 아버지 맞으시지요?"],
    ["심봉사", ["그리움", "놀람"], "딸의 목소리를 따라 손을 뻗다가 눈을 뜬다.", "청아! 네 목소리를 다시 듣는구나!"],
    ["왕", ["따뜻함", "품위"], "두 사람의 만남을 지켜보고 잔치를 멈춰 세운다.", "오늘의 주인공은 왕이 아니라 이 부녀다."],
    ["뺑덕어멈", ["뻔뻔함", "후회"], "심봉사를 외면했던 일을 고백하고 사과한다.", "내 욕심이 눈보다 더 어두웠습니다."],
  ],
  5: [] as unknown as RoleSeed[],
  6: [] as unknown as RoleSeed[],
};
simRoles[5] = [...simRoles[4], ["맹인 잔치 안내인", ["친절", "기쁨"], "심봉사를 왕후 앞으로 안내하고 재회의 순간을 알린다.", "왕후마마께서 찾으시던 분이 바로 이분입니다!"]];
simRoles[6] = [...simRoles[5], ["황성 백성", ["공감", "감탄"], "재회의 기적을 모두에게 전하고 함께 환호한다.", "효심과 그리움이 마침내 서로를 찾았습니다!"]];

const byeolRoles: Record<TeamSize, RoleSeed[]> = {
  4: [
    ["토끼", ["재치", "침착"], "간을 육지에 두고 왔다며 태연하게 거짓말한다.", "귀한 간은 달빛에 말리려고 육지에 두고 왔지요."],
    ["별주부", ["충성", "당황"], "토끼를 데려왔지만 꾀를 의심한다.", "분명 간을 가지고 다닌다고 하지 않았느냐?"],
    ["용왕", ["위엄", "조급함"], "병을 고치려 토끼의 간을 내놓으라 명한다.", "어서 간을 내어 내 병을 고쳐라!"],
    ["문어 대신", ["의심", "논리"], "토끼의 말을 따져 묻지만 모순에 휘말린다.", "간을 몸 밖에 두고도 멀쩡할 수 있단 말이냐?"],
  ],
  5: [] as unknown as RoleSeed[],
  6: [] as unknown as RoleSeed[],
};
byeolRoles[5] = [...byeolRoles[4], ["상어 장군", ["성급함", "힘"], "궁문을 막다가 용왕의 명령에 길을 내준다.", "제가 당장 확인하겠습니다! …폐하의 명이라면 길을 열지요."]];
byeolRoles[6] = [...byeolRoles[5], ["해마 의원", ["신중", "양심"], "토끼의 간 처방이 근거 없다고 뒤늦게 밝힌다.", "폐하, 남을 해치는 처방은 옳지 않습니다."]];

const woochiRoles: Record<TeamSize, RoleSeed[]> = {
  4: [
    ["전우치", ["유쾌", "정의", "기지"], "도술로 빼앗긴 곡식 자루의 주인을 바꿔 놓는다.", "백성의 것을 훔친 자에게는 빈 자루가 어울리지."],
    ["탐관오리", ["탐욕", "오만"], "세금을 더 걷으라 명령하다 창고가 빈 것을 보고 당황한다.", "감히 내 곡식을 어디로 옮겼느냐!"],
    ["이방", ["눈치", "비겁함"], "명령을 따르다 증거 장부를 떨어뜨린다.", "사또, 이 장부만은 들키면 안 됩니다!"],
    ["장터 상인", ["용기", "재치"], "빼앗긴 물건을 알아보고 백성들을 이끈다.", "여기 적힌 물건은 모두 우리 것이오!"],
  ],
  5: [] as unknown as RoleSeed[],
  6: [] as unknown as RoleSeed[],
};
woochiRoles[5] = [...woochiRoles[4], ["포졸 대장", ["원칙", "갈등"], "전우치를 잡으려다 장부를 보고 탐관오리에게 창을 돌린다.", "법을 어긴 자가 사또라면 사또를 잡겠습니다."]];
woochiRoles[6] = [...woochiRoles[5], ["농부 만석", ["소박", "단호함"], "빼앗긴 볍씨를 찾아 억울함을 직접 증언한다.", "이 볍씨는 우리 마을의 내년입니다."]];

const commonBeats = {
  heungbu: [
    ["빈 손으로 찾아온 동생", "흥부 가족이 굶주린 사정을 안고 놀부의 집을 찾는다.", ["걱정", "긴장"], "도움을 청하는 이유를 한 문장으로 드러낸다.", ["빈 바가지", "낡은 보따리"], "차가운 대문 앞"],
    ["차가운 거절", "놀부 부부가 재산을 지키려 흥부를 몰아붙인다.", ["오만", "수치"], "거절의 말에 서로 다른 가치관이 드러난다.", ["쌀자루", "빗자루"], "닫혀 가는 대문"],
    ["이웃의 목소리", "주변 인물이 갈등을 목격하고 형제의 도리를 묻는다.", ["분노", "망설임"], "보고만 있지 않고 상황을 움직이는 말을 한다.", ["곡식 됫박"], "사람들이 모인 마당"],
    ["갈등 폭발", "놀부가 흥부를 밀어내고 흥부가 처음으로 자기 마음을 말한다.", ["분노", "서러움"], "흥부가 참아 온 감정을 직접 말한다.", ["넘어진 보따리"], "거친 바람"],
    ["한 됫박의 선택", "이웃이 가진 것을 나누며 놀부와 대비되는 행동을 보인다.", ["부끄러움", "연대"], "재물보다 중요한 것이 무엇인지 말한다.", ["작은 쌀자루"], "조용해진 마당"],
    ["돌아서는 흥부", "흥부 가족이 서로를 붙들고 떠나며 다음 선택을 다짐한다.", ["슬픔", "희망"], "가난해도 잃지 않을 가치를 선언한다.", ["보따리"], "노을 진 길"],
  ],
  chunhyang: [
    ["옥중의 명령", "변학도가 춘향에게 마지막으로 수청을 강요한다.", ["압박", "긴장"], "권력의 명령을 분명히 들려준다.", ["명령패", "옥문"], "어두운 관아"],
    ["춘향의 거절", "춘향이 두려움을 누르고 자신의 뜻을 밝힌다.", ["두려움", "결의"], "거절의 근거를 자신의 말로 만든다.", ["밧줄"], "한 줄기 빛"],
    ["수상한 나그네", "초라한 이몽룡과 방자가 관아의 상황을 살핀다.", ["의심", "기대"], "반전을 암시하되 정체는 숨긴다.", ["삿갓", "부채"], "소란스러운 잔치"],
    ["부당함의 증언", "향단과 형방이 변학도의 횡포를 증언한다.", ["용기", "당황"], "구체적인 잘못 한 가지를 폭로한다.", ["장부"], "멈춰 선 잔치"],
    ["마패를 들다", "이몽룡이 암행어사의 정체를 밝힌다.", ["놀람", "통쾌함"], "모두의 시선을 모을 선언을 외친다.", ["마패"], "문이 활짝 열리는 순간"],
    ["뒤집힌 권력", "변학도가 붙잡히고 춘향은 자신의 선택을 확인한다.", ["해방", "감격"], "반전 뒤 춘향이 마지막 말을 한다.", ["포승줄"], "밝아진 관아"],
  ],
  honggildong: [
    ["금지된 호칭", "길동이 아버지를 아버지라 부르지 못하는 서러움을 토로한다.", ["서러움", "절제"], "가장 아픈 호칭을 직접 말한다.", ["족보", "서책"], "깊은 밤 사랑채"],
    ["법도라는 벽", "홍 판서가 길동을 아끼면서도 신분 질서를 내세운다.", ["답답함", "갈등"], "아버지의 모순된 마음을 보여준다.", ["관복"], "무거운 침묵"],
    ["다가오는 위협", "초란의 계략과 자객의 낌새가 드러난다.", ["불안", "경계"], "위험을 알리는 구체적인 단서를 말한다.", ["비밀 편지", "단검"], "그림자가 긴 복도"],
    ["스스로를 증명하다", "길동이 재주로 위협을 막고 더는 숨지 않겠다고 결심한다.", ["분노", "자신감"], "자신의 능력과 뜻을 함께 선언한다.", ["부러진 칼"], "바람 부는 마당"],
    ["가족의 마지막 말", "어머니와 형이 길동의 선택을 걱정하면서도 지지한다.", ["걱정", "신뢰"], "떠나는 사람에게 꼭 필요한 말을 건넨다.", ["도포", "보따리"], "새벽빛"],
    ["새 길을 향해", "길동이 부당한 세상을 바꾸기 위해 집을 떠난다.", ["결의", "희망"], "어떤 세상을 만들지 한 문장으로 말한다.", ["지팡이"], "열린 대문 너머"],
  ],
  simcheong: [
    ["맹인 잔치의 손님", "심봉사가 딸을 그리워하며 황성의 잔치에 들어온다.", ["기대", "그리움"], "찾고 싶은 사람의 이름을 부른다.", ["지팡이"], "북적이는 궁궐"],
    ["익숙한 목소리", "심청이 사람들 사이에서 아버지의 목소리를 알아듣는다.", ["놀람", "떨림"], "기억 속 목소리를 확인하는 질문을 한다.", ["잔치상"], "소리가 멎는 순간"],
    ["감춰 둔 진실", "심청이 자신의 정체와 지난 일을 밝힌다.", ["슬픔", "설렘"], "이별 뒤 자신에게 일어난 일을 짧게 말한다.", ["왕후의 비녀"], "모두가 둘러선 자리"],
    ["손끝으로 알아보다", "심봉사가 손으로 딸의 얼굴을 더듬으며 확인한다.", ["그리움", "의심"], "확신하고 싶어 하는 아버지의 말을 만든다.", ["손수건"], "따뜻한 조명"],
    ["눈을 뜨는 순간", "기쁨 속에서 심봉사가 눈을 뜨고 딸을 마주한다.", ["환희", "감격"], "처음 본 딸의 얼굴에 건넬 말을 만든다.", ["꽃잎 효과"], "밝아지는 무대"],
    ["서로를 찾은 부녀", "두 사람이 서로를 끌어안고 주변 인물도 자신의 잘못과 기쁨을 말한다.", ["용서", "기쁨"], "재회의 의미를 모두가 한마디씩 보탠다.", ["꽃다발"], "축제의 궁궐"],
  ],
  byeoljubu: [
    ["용궁의 재판", "토끼가 용왕 앞에서 간을 내놓으라는 말을 듣는다.", ["공포", "당황"], "위기의 조건을 모두가 알게 한다.", ["용왕 의자", "산호"], "푸른 용궁"],
    ["간을 두고 왔습니다", "토끼가 간을 육지에 두고 왔다는 기발한 거짓말을 시작한다.", ["침착", "의심"], "말도 안 되는 주장을 그럴듯하게 설명한다.", ["빈 보자기"], "숨죽인 궁전"],
    ["의심의 질문", "문어 대신과 해마 의원이 토끼의 논리를 따져 묻는다.", ["의심", "초조"], "토끼가 대답하기 어려운 질문을 던진다.", ["진료 두루마리"], "팽팽한 원탁"],
    ["서로 다른 충성", "별주부와 신하들이 용왕을 살리는 방법을 두고 다툰다.", ["갈등", "죄책감"], "충성이 무엇인지 다른 생각을 말한다.", ["창", "의원 가방"], "흔들리는 물결"],
    ["육지로 보내라", "토끼가 간을 가져오겠다며 자신을 돌려보내도록 설득한다.", ["기대", "조급함"], "용왕이 믿게 만들 마지막 조건을 제시한다.", ["통행패"], "열리는 용궁 문"],
    ["통쾌한 탈출", "육지에 오른 토끼가 진실을 밝히고 별주부도 자신의 선택을 돌아본다.", ["해방", "깨달음"], "힘과 지혜 중 무엇이 이겼는지 말한다.", ["바위", "물결"], "햇빛 비치는 해변"],
  ],
  jeonwoochi: [
    ["빼앗긴 장터", "탐관오리가 백성의 곡식과 물건을 세금이라며 빼앗는다.", ["억울함", "오만"], "구체적으로 무엇을 빼앗겼는지 증언한다.", ["곡식 자루", "세금 장부"], "소란스러운 장터"],
    ["수상한 도사", "전우치가 능청스럽게 나타나 탐관오리의 명령을 비튼다.", ["호기심", "여유"], "도술을 쓰기 전 말로 상대를 흔든다.", ["부채", "도술 부적"], "바람이 이는 광장"],
    ["뒤바뀐 창고", "도술로 관아의 곡식이 백성 앞에 나타나고 빈 자루만 남는다.", ["놀람", "통쾌함"], "각자 자기 물건을 알아보고 외친다.", ["빈 자루", "볍씨"], "빛나는 효과"],
    ["떨어진 비밀 장부", "이방이 숨기던 장부를 떨어뜨려 횡포의 증거가 드러난다.", ["당황", "분노"], "장부의 기록 한 줄을 소리 내어 읽는다.", ["비밀 장부"], "멈춰 선 포졸들"],
    ["창끝이 향한 곳", "포졸 대장이 법과 권력 사이에서 선택해 탐관오리를 붙잡는다.", ["갈등", "결단"], "누구를 지키는 법인지 선언한다.", ["창", "포승줄"], "엄숙한 관아 앞"],
    ["돌아온 내일", "백성이 물건을 되찾고 전우치는 웃으며 다음 길로 떠난다.", ["환호", "희망"], "바뀐 장터와 지켜야 할 약속을 말한다.", ["나눠진 곡식", "부채"], "따뜻한 노을"],
  ],
} satisfies Record<WorkId, BeatSeed[]>;

export const CLASSIC_WORKS: ClassicWork[] = [
  work({ id: "heungbu", title: "흥부전", tagline: "가난 속에서도 나눔을 선택한 사람", easyContext: "착한 흥부는 많은 식구와 가난하게 살지만 욕심 많은 형 놀부는 큰 부자입니다. 가족을 위해 형에게 도움을 청하러 간 날, 두 형제의 생각 차이가 크게 부딪힙니다.", highlightTitle: "닫힌 대문 앞, 형제의 갈등", sceneContext: "흥부가 굶주린 가족을 위해 놀부의 집을 찾았지만 차갑게 거절당합니다. 주변 인물들의 선택이 갈등을 더 크게 만들고, 흥부는 자신이 지킬 가치를 정합니다.", color: "#8f4e32", accent: "#f1c27d", props: ["빈 바가지", "쌀자루", "낡은 보따리", "빗자루"], backgrounds: ["놀부의 기와집 대문", "흥부의 초가집", "마을길"], emotions: ["서러움", "분노", "부끄러움", "희망"], bgmKeywords: ["국악 타악", "긴장", "따뜻한 결말", "해금"] }, heungbuRoles, commonBeats.heungbu),
  work({ id: "chunhyang", title: "춘향전", tagline: "권력 앞에서도 뜻을 굽히지 않은 선택", easyContext: "춘향은 떠난 이몽룡을 기다리며 자신의 마음을 지킵니다. 새 사또 변학도는 권력을 이용해 춘향을 굴복시키려 하지만, 잔치날 예상하지 못한 반전이 일어납니다.", highlightTitle: "암행어사 출두요!", sceneContext: "옥중의 춘향이 변학도의 마지막 강요를 거절합니다. 초라한 나그네처럼 들어온 이몽룡이 마패를 들며 권력 관계가 순식간에 뒤집힙니다.", color: "#9f2942", accent: "#f3c6cc", props: ["마패", "옥문", "장부", "삿갓"], backgrounds: ["남원 관아", "옥사", "잔치 마당"], emotions: ["두려움", "결의", "놀람", "통쾌함"], bgmKeywords: ["대금", "긴장 고조", "장엄한 반전", "북"] }, chunhyangRoles, commonBeats.chunhyang),
  work({ id: "honggildong", title: "홍길동전", tagline: "이름과 세상의 벽을 넘어선 결심", easyContext: "뛰어난 재주를 가진 홍길동은 신분 때문에 아버지를 아버지라 부르지 못합니다. 집안의 위협까지 겹치자 길동은 부당한 세상을 바꾸기 위해 떠날 결심을 합니다.", highlightTitle: "아버지를 아버지라 부르지 못하고", sceneContext: "길동이 감춰 온 서러움을 아버지에게 털어놓습니다. 위협을 이겨 낸 뒤 가족과 마지막 말을 나누며 스스로의 길을 선택합니다.", color: "#1f5f66", accent: "#a9d7d2", props: ["족보", "서책", "도포", "단검"], backgrounds: ["홍 판서 사랑채", "깊은 밤 마당", "열린 대문"], emotions: ["서러움", "갈등", "결의", "희망"], bgmKeywords: ["거문고", "어두운 긴장", "영웅의 결심", "장구"] }, hongRoles, commonBeats.honggildong),
  work({ id: "simcheong", title: "심청전", tagline: "그리움 끝에서 서로를 다시 찾다", easyContext: "심청은 아버지를 위해 큰 희생을 한 뒤 기적적으로 왕후가 됩니다. 아버지를 찾기 위해 연 맹인 잔치에서 오래 그리워한 목소리를 다시 듣습니다.", highlightTitle: "아버지, 눈을 떠 저를 보세요", sceneContext: "황성 맹인 잔치에서 심청과 심봉사가 재회하는 장면입니다. 목소리와 손끝으로 서로를 확인하고, 감격 속에서 심봉사의 눈이 열립니다.", color: "#315a8f", accent: "#c5d7f2", props: ["지팡이", "왕후 비녀", "손수건", "꽃잎"], backgrounds: ["황성 궁궐", "맹인 잔치상", "연꽃 무대"], emotions: ["그리움", "놀람", "감격", "용서"], bgmKeywords: ["해금 독주", "잔잔한 물결", "감동", "환한 피날레"] }, simRoles, commonBeats.simcheong),
  work({ id: "byeoljubu", title: "별주부전", tagline: "위기에서 빛난 토끼의 재치", easyContext: "병든 용왕을 위해 별주부는 토끼의 간을 구하러 육지에 갑니다. 속아서 용궁에 온 토끼는 자신이 위험에 빠졌다는 사실을 알고 기발한 꾀를 냅니다.", highlightTitle: "제 간은 육지에 두고 왔습니다", sceneContext: "용궁 재판에서 토끼가 간을 내놓으라는 명령을 받습니다. 토끼는 말과 논리로 신하들을 흔들고 마침내 육지로 돌아갈 기회를 얻습니다.", color: "#276b78", accent: "#a8e0dc", props: ["산호", "통행패", "의원 가방", "빈 보자기"], backgrounds: ["용궁 대전", "바닷속 문", "햇빛 비치는 해변"], emotions: ["공포", "침착", "의심", "해방"], bgmKeywords: ["수중 신비", "익살", "빠른 장단", "통쾌함"] }, byeolRoles, commonBeats.byeoljubu),
  work({ id: "jeonwoochi", title: "전우치전", tagline: "도술로 뒤집은 탐욕의 판", easyContext: "재치 있는 도사 전우치는 도술로 나쁜 권력자를 골탕 먹이고 백성을 돕습니다. 장터의 곡식까지 빼앗는 탐관오리 앞에 나타나 상황을 통째로 뒤집습니다.", highlightTitle: "탐관오리의 창고가 열린 날", sceneContext: "탐관오리가 백성의 재산을 빼앗는 장터에 전우치가 나타납니다. 도술로 증거와 곡식을 되찾고, 권력자의 부하들까지 정의로운 선택을 하게 만듭니다.", color: "#5a3d8f", accent: "#d8c6f2", props: ["부채", "도술 부적", "세금 장부", "곡식 자루"], backgrounds: ["조선 장터", "관아 창고", "관아 앞 광장"], emotions: ["억울함", "여유", "놀람", "통쾌함"], bgmKeywords: ["신비한 피리", "빠른 타악", "익살", "영웅적 결말"] }, woochiRoles, commonBeats.jeonwoochi),
];

export const SAMPLE_CLASSROOM: Classroom = {
  id: "class-literature-2026",
  schoolName: "한빛중학교",
  name: "2학년 3반 고전문학 영상연극",
  teacherName: "김문학",
  adminCode: "STAGE2026",
  teams: [
    { id: "team-moon", classId: "class-literature-2026", code: "MOON24", name: "달빛극단", size: 4, phase: "script", workId: "chunhyang", students: ["민서", "지후", "서윤", "도현"].map((name, index) => ({ id: `moon-${index + 1}`, name, teamId: "team-moon" })), customCharacters: [], scripts: [], stageItems: {}, stageConfirmed: [], musicCandidates: [], bgmVolume: .16, recordings: [] },
    { id: "team-wave", classId: "class-literature-2026", code: "WAVE55", name: "물결스튜디오", size: 5, phase: "stage", workId: "byeoljubu", students: ["하린", "준서", "유나", "시우", "채원"].map((name, index) => ({ id: `wave-${index + 1}`, name, teamId: "team-wave" })), customCharacters: [], scripts: [], stageItems: {}, stageConfirmed: [], musicCandidates: [], bgmVolume: .16, recordings: [] },
    { id: "team-star", classId: "class-literature-2026", code: "STAR66", name: "별무대", size: 6, phase: "recording", workId: "heungbu", students: ["예준", "소율", "현우", "다은", "건우", "지아"].map((name, index) => ({ id: `star-${index + 1}`, name, teamId: "team-star" })), customCharacters: [], scripts: [], stageItems: {}, stageConfirmed: [], musicCandidates: [], bgmVolume: .16, recordings: [] },
  ],
};

export function getWork(workId?: string) {
  return CLASSIC_WORKS.find((item) => item.id === workId);
}

export function getVariant(workId: WorkId, size: TeamSize) {
  return getWork(workId)?.variants[size];
}
