<div align="center">

# ⚗️ Lab Reação Exotérmica

### Simulador da Hidrólise do Anidrido Acético

*Desenvolvido para o laboratório PQI-3140/3101/3102 — Escola Politécnica da USP*

---

![React](https://img.shields.io/badge/React-18-61DAFB?style=for-the-badge&logo=react&logoColor=black)
![Recharts](https://img.shields.io/badge/Recharts-2.x-22b5bf?style=for-the-badge)
![Vercel](https://img.shields.io/badge/Vercel-Deploy-000000?style=for-the-badge&logo=vercel)
![License](https://img.shields.io/badge/Licença-MIT-a8ff3e?style=for-the-badge)

</div>

---

## 📋 Sobre o Projeto

Este simulador foi desenvolvido como ferramenta de apoio para a **Experiência 4 — Reação Química Exotérmica** do laboratório de Fundamentos das Transformações Químicas da Poli-USP.

A reação estudada é a **hidrólise do anidrido acético** em fase líquida:

```
(CH₃CO)₂O  +  H₂O  →  2 CH₃COOH
  Anidrido       Água       Ácido Acético

  ΔHᵣ = –14,4 ± 0,3 kcal/mol  (reação exotérmica)
```

O app oferece dois modos de uso: entrada manual dos dados medidos no laboratório, e simulação automática de múltiplos cenários experimentais.

---

## ✨ Funcionalidades

### 📋 Modo Manual
- Tabela com **50 entradas** de tempo × temperatura
- Geração automática do **gráfico T × t**
- Cálculo completo da **composição** no estado inicial e final (massa, moles, fração molar)
- Cálculo individual de **Cp** para cada substância via polinômio de correlação
- Estimativa de **Q liberado** e **T_max** teórica vs. simulada
- Identificação automática de **t_pico** e **T_pico**
- Discussão termodinâmica automática (isobárico, isotérmico, trabalho, ΔH)

### 🔬 Modo Simulação
- **8 cenários experimentais** combinando:
  - ✅ Com isolamento térmico / ❌ Sem isolamento
  - ⚡ Agitação rápida / 🐢 Agitação lenta
  - 💨 Com ventilação / 🔇 Sem ventilação
- Variação de **T_ar** em um range configurável (ex: 20–30 °C)
- Gráfico **comparativo de T_max** entre todos os cenários
- Todos os cálculos termodinâmicos para cada cenário

---

## 🧮 Fundamentação Teórica

### Calor Específico
Calculado via correlação polinomial (válida para 273 ≤ T ≤ 373 K):

```
Cp = a + b·T + c·T² + d·T³     [J/mol·K,  T em K]
```

| Substância   |     a      |      b      |      c       |      d      | MM (g/mol) | ρ (kg/m³) |
|:------------|:----------:|:-----------:|:------------:|:-----------:|:----------:|:---------:|
| Água        |  92,1101   | –4,00×10⁻²  | –2,21×10⁻⁴  |  5,35×10⁻⁷ |    18,0    |   1000    |
| Anidrido Ac.|  71,8      |  8,89×10⁻¹  | –2,65×10⁻³  |  3,35×10⁻⁶ |   102,1    |   1080    |
| Ácido Ac.   | –18,9      |  1,10       | –2,89×10⁻³  |  2,93×10⁻⁶ |    60,0    |   1050    |

### Cp da Mistura
```
Cp_mistura = Σ xᵢ · Cpᵢ
```
onde xᵢ é a fração molar de cada componente.

### Balanço de Energia
```
Q = –n_reagido · ΔHᵣ

Q = n_total_fin · Cp_médio · ΔT   →   T_max = T_ini + Q / (n_total · Cp_médio)
```
O Cp médio é calculado iterativamente entre os estados inicial e final.

---

## 🚀 Como Rodar Localmente

### Pré-requisitos
- [Node.js](https://nodejs.org) (versão LTS)
- npm (incluso no Node.js)

### Instalação

```bash
# Clone o repositório
git clone https://github.com/seuusuario/lab-quimica.git

# Entre na pasta
cd lab-quimica

# Instale as dependências
npm install

# Rode o projeto
npm start
```

O app abre automaticamente em `http://localhost:3000`.

### Acessar pelo celular (mesma rede Wi-Fi)

```bash
# Descubra o IP da sua máquina
ipconfig        # Windows
ifconfig        # Mac/Linux

# Acesse no celular:
http://192.168.x.x:3000
```

---

## ☁️ Deploy

O projeto está hospedado na **Vercel** com deploy contínuo via GitHub.

Qualquer `git push` na branch `main` dispara um novo deploy automaticamente.

```bash
# Para atualizar o deploy
git add .
git commit -m "descrição da mudança"
git push
```

---

## 🗂️ Estrutura do Projeto

```
lab-quimica/
├── public/
│   └── index.html
├── src/
│   ├── App.js          # Componente principal — toda a lógica e UI
│   └── index.js        # Entry point React
├── package.json
└── README.md
```

---

## 🔬 Cenários Simulados

| # | Isolamento | Agitação | Ventilação | T_max (fração do teórico) |
|:-:|:----------:|:--------:|:----------:|:-------------------------:|
| 1 | ✅ Sim     | ⚡ Rápida | ❌ Não     | 97%                       |
| 2 | ✅ Sim     | ⚡ Rápida | 💨 Sim     | 90%                       |
| 3 | ✅ Sim     | 🐢 Lenta  | ❌ Não     | 92%                       |
| 4 | ✅ Sim     | 🐢 Lenta  | 💨 Sim     | 85%                       |
| 5 | ❌ Não     | ⚡ Rápida | ❌ Não     | 70%                       |
| 6 | ❌ Não     | ⚡ Rápida | 💨 Sim     | 58%                       |
| 7 | ❌ Não     | 🐢 Lenta  | ❌ Não     | 62%                       |
| 8 | ❌ Não     | 🐢 Lenta  | 💨 Sim     | 50%                       |

---

## 🛠️ Tecnologias

| Tecnologia | Uso |
|:-----------|:----|
| [React 18](https://react.dev) | Interface e gerenciamento de estado |
| [Recharts](https://recharts.org) | Gráficos interativos |
| [Vercel](https://vercel.com) | Hospedagem e deploy contínuo |

---

## 📖 Referências

- Atkins, P.; Paula, J. *Físico-Química*, v.1, 9ª ed. Rio de Janeiro: LTC, 2012.
- Atkins, P.; Jones, L. *Princípios de Química*. 2ª ed., Porto Alegre: Bookman, 2001.
- Hirota et al. *Hydrolysis of acetic anhydride: Non-adiabatic calorimetric determination of kinetics and heat exchange*. Chem. Eng. Sci., v.65, p3849-3858, 2010.
- Roteiro PQI-3140 — Departamento de Engenharia Química, Poli-USP, 2023.

---

<div align="center">

Desenvolvido para o laboratório de **Engenharia Química — Poli-USP** 🧪

</div>
